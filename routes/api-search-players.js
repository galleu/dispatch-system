module.exports = {
    path: '/api/search/players',
    method: 'GET',
    handler: function (req, res, next, db) {
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
    }
}