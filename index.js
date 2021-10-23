// TODO: REMOVE ALL SENSITIVE DATA


const fetch = require("node-fetch")
const express = require('express');
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const app = express()
var ewss = require('express-ws')(app);
const db = require("./db");

// Commented out for now, but might be used later
// const cdn = require("./cdn")

const discord = require("./discord")

const config = require("./config.json")

app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(express.json());

// Middleware to check if the user is logged in and get the users session and user data from the database
app.use((req, res, next) => {
    // Log the request url
    console.log("Request to", req.url)
    // Check the database for the session
    const session = db.sessions.check(req.cookies.session);
    // Set request session and user to null if the session is not found
    if (!session) {        
        req.session = null;
        req.user = null;
        next();
        return;
    } else {
        // Get the user data from the database
        const user = db.users.get(session.user);
        if (!user) {
            // Return an error to the client and delete the session from the database if the user is not found
            db.sessions.deleted(req.cookies.session);
            res.status(401).send("Session user does not exists");
            return;
        } else {
            // Set the request session and user and continue the request
            console.log("Session user", user.id)
            req.session = session;
            req.user = user;
            next();
        }
    }
});



app.get('/', (req, res, next) => {
    console.log(req.session)
    if (req.session) {
        console.log("Index Request", req.session.user)
        // Make sure the user is logged in and has permission to view this page
        if ((req.user.flags & 2) == 2) {
            res.render("index", { user: req.user });
        } else {
            // If the user does not have permission to view this page, return a holding/error page
            res.render("error", {username: req.user.discord.username, message: "You are now waiting to be approved. You will get a message from staff when your account has been approved.", status: false})
        }
    } else {
        // If the user is not logged in, return the public landing page
        res.render("public"); return;
    }
})

// Return the admin page for Super Admins only
app.get("/admin", (req, res, next) => {
    if (req.session) {
        // Super Admins only 128
        if ((req.user.flags & 128) == 128) {
            // TODO: REMOVE ALL SENSITIVE DATA
            const users = db.users.getAll();
            res.render("admin", { users })
        } else {
            next([403, "You do not have permissions to access this page"])
        }
    } else {
        next()
    }
})



app.get("/auth", async (req, res, next) => {
    if (req.query.code) {
        let tokenReq = await fetch("https://discord.com/api/v8/oauth2/token", {
            method: "POST",
            headers: {"content-type": "application/x-www-form-urlencoded"},
            body: `client_id=${config.client_id}&client_secret=${config.client_secret}&grant_type=authorization_code&code=${encodeURIComponent(req.query.code)}&redirect_uri=${encodeURIComponent(config.redirectURL)}`
        })
        if (tokenReq.status === 200) {
            let discord_token = await tokenReq.json();
            if (discord_token.scope !=='identify email guilds') res.next([401, "Invalid Oauth Scopes"]);

            const discord_user = await fetch("https://discord.com/api/v8/users/@me", {
                headers: { "Authorization": "Bearer "+discord_token.access_token }
            });

            if (discord_user.ok) {        
                discord_user_data = await discord_user.json();


                // Make sure the user's discord account is verified
                if (!discord_user_data.verified) { next([401, "Your discord account is not verified"]); return; }
                if (!discord_user_data.email) { next([401, "Your discord account does not have an email"]); return; }
                if (!discord_user_data.username) { next([401, "Your discord account does not have a username"]); return; }

                // Get the user from the database
                let user = db.users.get(discord_user_data.id);

                if (!user) user = {flags: 0};
                if (!user.metadata) user.metadata = {};

                // Set the user's avatar to there discord avatar
                user.avatar = `https://cdn.discordapp.com/avatars/${discord_user_data.id}/${discord_user_data.avatar}.png?size=512`;

                // Update the user discord data
                user.discord = discord_user_data;
                user.discord_token = discord_token;
                
                // Update the user metadata
                user.metadata.lastLogin = Date.now();
                
                /* IP logging, might be removed later
                const ip = req.headers["CF-Connecting-IP"] || "0.0.0.0";
                user.metadata.ip = ip;
                if(!user.metadata.ips) user.metadata.ips = [];
                user.metadata.ips.push(ip);
                */
               
                try {
                    // Get the user member data
                    const member = await discord.getMember(user.discord.id);
                    // Make sure the user is in the guild
                    if (!member) { next([401, "You need to be a member of the guild to access this site"]); return; }
                    
                    user.member = member;
                    user.username = member.nick || member.user.username;
                    user.email = user.discord.email;

                    // Send a message in the logs channel to let staff know the user has logged in, if logging is enabled
                    if (config.logging) await discord.sendLog(1, "User Login", `User <@!${user.discord.id}> has logged in on <t:${Math.floor(+new Date() / 1000)}>`);
                    
                    
                    // Update the user in the database
                    db.users.set(user.discord.id, user);

                    // Create a new session for the user
                    const token = db.sessions.create(user.discord.id);

                    // Set the cookie for the user
                    res.cookie('session', token, { maxAge: 2592000000, httpOnly: true })
                    
                    // Redirect the user to the index page
                    res.redirect(302, '/'); return;
                } catch (err) {
                    console.error(err);
                    res.status(500).render("error", {message: "An error occurred while logging you in. Please try again later.", username: user.discord.username, status: 500})
                    return;
                }
            } else {
                // Return an error if the users Discord account is not valid/found
                next([500, "Error getting user from discord"]); return;
            };
        } else {
            // Error of the token request failed
            let data = await tokenReq.text();
            next([500, data]); return;
        }
    } else {
        // Return discord oauth redirect if no code is provided
        res.redirect(302, `https://discord.com/api/oauth2/authorize?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(config.redirectURL)}&response_type=code&scope=identify%20email%20guilds`)
    };
})

// Log the user out and redirect them to the index page
app.get('/logout', (req, res) => {
    if (req.session) {
        db.sessions.deleted(req.session.id)
    };
    // clear the session cookie
    res.clearCookie('session');
    return res.redirect(302, "/")
})


ewss.broadcast = function(data) {
    ewss.getWss().clients.forEach((client) => {
        if (client.user) {
            client.send(JSON.stringify(data));
        }
    });
};

// The websocket gateway for all interactions
app.ws('/api/gateway', function(ws, req) {
    // Make sure the user is logged in
    if (!req.session) {
        ws.close(4001, "User not logged in");
        return;
    } else {
        const user = req.user;
        if (!(req.user.flags & 2) == 2) {
            ws.close(4001, "Missing Permissions");
            return;
        } else {
            ws.on('close', () => { 
                if (ws.user) {
                    console.log("Websocket Closed", ws.user.id, Date.now());
                    ewss.broadcast({
                        method: "update",
                        status: "offline",
                        user: ws.user
                    })
                } else {
                    console.log("Websocket Closed", "Unknown User", Date.now());
                }
            });

            ws.on('message', function(msg) {
                if (!ws.user) {
                    // Close all other users sessions to prevent duplicate sessions form the same user
                    ewss.getWss().clients.forEach((client) => { 
                        if (client.user && client.user.id === req.user.id) {
                            console.log("Closing duplicate session", client.user.id, Date.now());
                            client.close(4001, "Session Replace");
                        } else return;
                    })
                    ws.user = {
                        username: user.username,
                        id: user.id,
                        avatar: user.avatar
                    };
                    ewss.broadcast({
                        method: "update",
                        status: "online",
                        user: ws.user
                    })
                };
                try {
                    // Parse the message as JSON
                    const data = JSON.parse(msg)
                    // Determine the type of message
                    if (data.method === "ping") {
                        // Echo the message back to the client
                        ws.send(msg);
                    } else if (data.method === "update") {
                        
                    } else if (data.method == 'get') {
                        if (data.status === 'online') {
                            ewss.getWss().clients.forEach((client) => {
                                if (client.user) {
                                    ws.send(JSON.stringify({
                                        method: "update",
                                        status: "online",
                                        user: client.user
                                    }))
                                }
                            })
                        }
                    } else {
                        // Return an unknown method error if the method is not found
                        ws.send(JSON.stringify({method: "error", message: "Unknown method", display: false}))
                    }
                } catch (err) {
                    ws.send(JSON.stringify({method: "error", message: err.message, display: true}))
                }
            });
        }
    }
});


// Player API get all users players
app.get('/api/players', async (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in"); return;
    } else {
        if ((req.user.flags & 2) == 2) {
            const players = await db.players.getAll();
            players.filter((player) => player.owner === req.user.id);
            res.status(200).send(players); return;
        } else {
            res.status(401).send("Missing Permissions"); return;
        };
    }
});

// Player api
app.get('/api/players/:id', async (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 2) == 2) {
            const player = db.players.get(req.params.id);
            if (!player) {
                res.status(404).send("Player not found");
                return;
            } else {
                res.send(player);
            }
        } else {
            res.status(401).send("Session user does not exists");
            return;
        }
    }
});

// Player api for making a new player
app.post('/api/players', async (req, res) => {
    if (req.session) {
        if ((req.user.flags & 32) == 32) {
            const player = {
                nameFirst: req.body.nameFirst,
                nameLast: req.body.nameLast,
                address: req.body.address,
                dob: req.body.dob,
                eye: req.body.eye,
                hair: req.body.hair,
                height: req.body.height,
                weight: req.body.weight,
                sex: req.body.sex,
                picture: req.body.picture || "",
                wanted: false,
                owner: req.user.id,
            };
            const id = db.players.create(player);
            res.status(200).send(id);
        }
    } else {
        next(401); return;
    }
})


// Search API for players
app.get('/api/search/players', (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 32) == 32) {
            const players = db.players.getAll();
            if (req.query.name) {
                const results = players.filter((player) => ((player.nameFirst.toLowerCase() +" "+player.nameLast.toLowerCase()).includes(req.query.name.toLowerCase()) && !player.metadata.deleted));
                res.status(200).send(results);
            } else if (req.query.license) {
                const results = players.filter((player) => player.license.id.includes(req.query.license));
                res.status(200).send(results);
            } else {
                res.status(400).send("Missing Query"); return;
            }
        } else {
            res.status(401).send("Missing Permissions");
            return;
        }
    }
});

// Search API for vehicles
app.get('/api/search/vehicles', (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 32) == 32) {
            const vehicles = db.registry.vehicles.getAll();
            if (req.query.plate) {
                const results = vehicles.filter((vehicle) => (vehicle.plate.toLowerCase().includes(req.query.plate.toLowerCase()) && !vehicle.metadata.deleted));
                res.status(200).send(results);
            } else if (req.query.make && req.query.model) {
                const results = vehicles.filter((vehicle) => (vehicle.make.toLowerCase().includes(req.query.make.toLowerCase()) && vehicle.model.toLowerCase().includes(req.query.model.toLowerCase()) && !vehicle.metadata.deleted));
                res.status(200).send(results);
            } else if (req.query.vin) {
                const results = vehicles.filter((vehicle) => (vehicle.vin.toLowerCase().includes(req.query.vin.toLowerCase()) && !vehicle.metadata.deleted));
                res.status(200).send(results);
            } else {
                res.status(400).send("Missing Query"); return;
            }
        } else {
            res.status(401).send("Missing Permissions"); return;
        }
    }
});

// Search API for weapons
app.get('/api/search/weapons', (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 32) == 32) {
            const weapons = db.registry.weapons.getAll();
            if (req.query.name) {
                const results = weapons.filter((weapon) => (weapon.name.toLowerCase().includes(req.query.name.toLowerCase()) && !weapon.metadata.deleted));
                res.status(200).send(results);
            } else if (req.query.serial) {
                const results = weapons.filter((weapon) => (weapon.serial.toLowerCase().includes(req.query.serial.toLowerCase()) && !weapon.metadata.deleted));
                res.status(200).send(results);
            } else {
                res.status(400).send("Missing Query"); return;
            }
        } else {
            res.status(401).send("Missing Permissions");
            return;
        }
    }
});


// API for registry
app.get('/api/registry/:type/:id', async (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 32) == 32) {
            if (req.params.type === 'weapons') {
                const weapon = db.registry.weapons.get(req.params.id);
                if (!weapon) {
                    res.status(404).send("Weapon not found");
                    return;
                } else {
                    res.send(weapon);
                }
            } else if (req.params.type === 'vehicles') {
                const vehicle = db.registry.vehicles.get(req.params.id);
                if (!vehicle) {
                    res.status(404).send("Vehicle not found");
                    return;
                } else {
                    res.send(vehicle);
                }
            } else {
                res.status(400).send("Invalid registry");
                return;
            }
        } else {
            next(401); return;
        }
    }
});

// API for adding a things to the registry
app.post('/api/registry/:type', async (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 2) == 2) {
            // TODO: Add validation
            if (req.params.type === 'weapons') {
                const weapon = {                        
                    flags: null,
                    type: req.body.type,
                    name: req.body.name,
                    serial: makeSerial(),
                    metadata: {
                        deleted: false,
                        created: +new Date(),
                        updated: +new Date()
                    }
                };
                const id = db.registry.weapons.create(weapon);
                res.status(200).send(id);
            } else if (req.params.type === 'vehicles') {
                const vehicle = {
                    make: "",
                    model: "",
                    year: "",
                    plate: "",
                    color: "",
                    owner: "",
                    flags: null,
                    metadata: {
                        deleted: false,
                        created: +new Date(),
                        updated: +new Date()
                    }
                };
                const id = db.registry.vehicles.create(vehicle);
                res.status(200).send(id);
            } else {
                res.status(400).send("Invalid registry");
                return;
            }
        }
    }
});

// API for registry patch
app.patch('/api/registry/:type/:id', async (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 2) == 2) {
            if (req.params.type === 'weapons') {
                next([400, "You can not update weapons registry"]);
            } else if (req.params.type === 'vehicles') {
                let vehicle = db.registry.vehicles.get(req.params.id);
                if (!vehicle) {
                    res.status(404).send("Vehicle not found");
                    return;
                } else {
                    vehicle = Object.assign(vehicle, req.body);
                    vehicle.metadata.updated = +new Date();
                    db.registry.vehicles.update(req.params.id, vehicle);
                    res.status(200).send(vehicle);
                }
            } else {
                res.status(400).send("Invalid registry");
                return;
            }
        }
    }
});

// API for registry delete
app.delete('/api/registry/:type/:id', async (req, res) => {
    if (!req.session) {
        res.status(401).send("User not logged in");
        return;
    } else {
        if ((req.user.flags & 2) == 2) {
            if (req.params.type === 'weapons') {
                next([400, "You can not delete weapons registry"]);
            } else if (req.params.type === 'vehicles') {
                let vehicle = db.registry.vehicles.get(req.params.id);
                if (!vehicle) {
                    res.status(404).send("Vehicle not found");
                    return;
                } else {
                    vehicle.metadata.deleted = true;
                    vehicle.metadata.updated = +new Date();
                    db.registry.vehicles.update(req.params.id, vehicle);
                    res.status(200).send(vehicle);
                }
            } else {
                res.status(400).send("Invalid registry");
                return;
            }
        }
    }
});

            

// Make a 8 character random seral number with numbers and letters
function makeSerial() {
    let serial = "";
    for (let i = 0; i < 8; i++) {
        serial += Math.floor(Math.random() * 10);
    }
    return serial;
};

// a function to validate user text input
function validate(text) {
    return text.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}
// a function to validate a json request
function validateJSON(json) {
    try {
        return JSON.parse(json);
    } catch (err) {
        console.error(err);
        return false;
    };
}


app.use(function (err, req, res, next) {
    console.error(err);
    if (err > 100 && err < 600) {
        res.status(404).render("error", {message: "The page you are looking for does not exist.", username: false, status: 404})
    } else if (err[0] && err[1]) {
        res.status(err[0]).render("error", {message: err[1], username: false, status: err[0]})
    } else {
        res.status(500).render("error", {message: "An error occurred while processing your request.", username: false, status: 500})
    }
  })


app.listen(config.port, () => {
  console.log(`Listening at http://localhost:${config.port}`)
})