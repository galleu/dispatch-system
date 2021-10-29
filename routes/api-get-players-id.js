module.exports = {
    path: '/api/players/:id',
    method: 'GET',
    handler: function (req, res, next, db) {
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
    }
}
