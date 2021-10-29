const config = require('../config.json');
const discord = require('../discord.js');
module.exports = {
    path: '/auth',
    method: 'GET',
    handler: function (req, res, next, db) {
        if (req.query.code) {
            fetch("https://discord.com/api/v8/oauth2/token", {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: `client_id=${config.client_id}&client_secret=${config.client_secret}&grant_type=authorization_code&code=${encodeURIComponent(req.query.code)}&redirect_uri=${encodeURIComponent(config.redirectURL)}`
            }).then(tokenReq => {
                if (tokenReq.status === 200) {
                    tokenReq.json().then(discord_token => {
                        if (discord_token.scope !== 'identify email guilds') res.next([401, "Invalid Oauth Scopes"]);
                        fetch("https://discord.com/api/v8/users/@me", {
                            headers: { "Authorization": "Bearer " + discord_token.access_token }
                        }).then(discord_user => {
                            if (discord_user.ok) {
                                discord_user.json().then(discord_user_data => {
                                    // Make sure the user's discord account is verified
                                    if (!discord_user_data.verified) { next([401, "Your discord account is not verified"]); return; }
                                    if (!discord_user_data.email) { next([401, "Your discord account does not have an email"]); return; }
                                    if (!discord_user_data.username) { next([401, "Your discord account does not have a username"]); return; }

                                    // Get the user from the database
                                    let user = db.users.get(discord_user_data.id);

                                    if (!user) user = { flags: 0 };
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
                                        discord.getMember(user.discord.id).then(member => {
                                            if (!member) { next([401, "You need to be a member of the guild to access this site"]); return; }

                                            // Make sure the user is in the guild
                                            user.member = member;
                                            user.username = member.nick || member.user.username;
                                            user.email = user.discord.email;

                                            // Send a message in the logs channel to let staff know the user has logged in, if logging is enabled
                                            if (config.logging) discord.log("Login", "User Login", `User <@!${user.discord.id}> has logged in on <t:${Math.floor(+new Date() / 1000)}>`);

                                            // Update the user in the database
                                            db.users.set(user.discord.id, user);

                                            // Create a new session for the user
                                            const token = db.sessions.create(user.discord.id);

                                            // Set the cookie for the user
                                            res.cookie('session', token, { maxAge: 2592000000, httpOnly: true })

                                            // Redirect the user to the index page
                                            res.redirect(302, '/'); return;
                                        });
                                    } catch (err) {
                                        console.error(err);
                                        res.status(500).render("error", { message: "An error occurred while logging you in. Please try again later.", username: user.discord.username, status: 500 })
                                        return;
                                    }
                                });
                            } else {
                                // Return an error if the users Discord account is not valid/found
                                next([500, "Error getting user from discord"]); return;
                            };
                        });
                    });
                } else {
                    // Error of the token request failed
                    next([500, "Request Failed"]); return;
                }

            }).catch(err => {
                console.log(err);
                res.sendStatus(500);
            });
        } else {
            // Return discord oauth redirect if no code is provided
            res.redirect(302, `https://discord.com/api/oauth2/authorize?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(config.redirectURL)}&response_type=code&scope=identify%20email%20guilds`)
        };
    }
}