const discord = require('../discord.js');
const config = require('../config.json');
module.exports = {
    path: '/api/gateway',
    method: 'WS',
    handler: function (wss, ws, req, db) {
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
                        wss.broadcast(ws, {
                            method: "update",
                            status: "offline",
                            user: ws.user
                        })
                        config.logging && discord.log("Websocket Closed", `Websocket for <@!${ws.user.id}> has been closed on <t:${Math.floor(+new Date() / 1000)}>`);
                    } else {
                        console.log("Websocket Closed", "Unknown User", Date.now());
                    }
                });

                ws.on('message', function (msg) {
                    if (!ws.user) {
                        // Close all other users sessions to prevent duplicate sessions form the same user
                        wss.getWss().clients.forEach((client) => {
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
                        const roles = discord.getRoles(user.id)
                        if (config.mdt_roles.some(r => roles.includes(r))) {
                            ws.user.is_mdt = true;
                        };
                        wss.broadcast(ws, {
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
                            if (data.status === 'mdt') {
                                if (!ws.user.is_mdt) return;
                                if (!data.payload && !data.payload.status) return;
                                if (data.payload.status && data.payload.status.length < 32) {
                                    wss.broadcast(ws, {
                                        method: "update",
                                        status: "online",
                                        user: data.payload.status
                                    });
                                }
                            }

                        } else if (data.method == 'get') {
                            if (data.status === 'online') {
                                wss.getWss().clients.forEach((client) => {
                                    if (client.user) {
                                        ws.send(JSON.stringify({
                                            method: "update",
                                            status: "online",
                                            user: client.user
                                        }))
                                    }
                                })
                            };
                            if (data.status === "mdt") {

                            }
                        } else {
                            // Return an unknown method error if the method is not found
                            ws.send(JSON.stringify({ method: "error", message: "Unknown method", display: false }))
                        }
                    } catch (err) {
                        ws.send(JSON.stringify({ method: "error", message: err.message, display: true }))
                    }
                });
            }
        }
    }
}