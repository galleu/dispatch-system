module.exports = {
    path: '/api/players',
    method: 'GET',
    handler: function (req, res, next, db) {
        if (!req.session) {
            res.status(401).send("User not logged in"); return;
        } else {
            if ((req.user.flags & 2) == 2) {
                const players = db.players.getAll()
                res.status(200).json(players.filter((player) => player.owner === req.user.id)); return;
            } else {
                res.status(401).send("Missing Permissions"); return;
            };
        }
    }
}