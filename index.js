const fetch = require("node-fetch")
const express = require('express');
const cookieParser = require("cookie-parser");
const app = express()
var wss = require('express-ws')(app);
const db = require("./db");
const fs = require('fs');
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

// Functions for all requests
app.use((req, res, next) => {
    req.func = {};
    // Make a 8 character random seral number with numbers and letter
    req.func.makeSerial = () => {
        let serial = "";
        for (let i = 0; i < 8; i++) { serial += Math.floor(Math.random() * 10) }
        return serial;
    };

    // Validate some text
    req.func.validateText = (text) => {
        if (text.length > 255) return false;
        if (/[^a-zA-Z0-9_]/g.test(text)) return false 
        return true;
    };

    // a function to validate a json request
    req.func.validateJSON = (json) => {
        try {
            return JSON.parse(json);
        } catch (err) {
            console.error(err);
            return false;
        };
    }
    next()
})


wss.broadcast = function (ws, data) {
    wss.getWss().clients.forEach((client) => {
        if (!client.user && !client.user.id) return
        client.send(JSON.stringify(data));
    });
};

const eventFiles = fs.readdirSync('./routes/').filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const route = require(`./routes/${file}`);
    console.log("Loading Routes File", file, route.method, route.path);
    if (route.method === "GET") {
        app.get(route.path, (req, res, next) => { route.handler(req, res, next, db) })
    } else if (route.method === "POST") {
        app.post(route.path, (req, res, next) => { route.handler(req, res, next, db) })
    } else if (route.method === "PATCH") {
        app.patch(route.path, (req, res, next) => { route.handler(req, res, next, db) })
    } else if (route.method === "DELETE") {
        app.delete(route.path, (req, res, next) => { route.handler(req, res, next, db) })
    } else if (route.method === "WS") {
        app.ws(route.path, (wss, ws, req) => { route.handler(ws, req, db) })
    } else {
        throw new Error("Invalid route method", route.method, route.path, file)
    }
}

app.use(function (err, req, res, next) {
    console.error(err);
    if (err > 100 && err < 600) {
        res.status(404).render("error", { message: "The page you are looking for does not exist.", username: false, status: 404 })
    } else if (err[0] && err[1]) {
        res.status(err[0]).render("error", { message: err[1], username: false, status: err[0] })
    } else {
        res.status(500).render("error", { message: "An error occurred while processing your request.", username: false, status: 500 })
    }
})


app.listen(config.port, () => {
    console.log(`Listening at http://localhost:${config.port}`)
})