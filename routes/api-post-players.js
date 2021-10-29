module.exports = {
    path: '/api/players',
    method: 'POST',
    handler: function (req, res, next, db) {
        if (req.session) {
            if ((req.user.flags & 32) == 32) {
                if (req.body.id) {
                    // For updating an existing player
                    let player = db.players.get(req.body.id);
                    if (!player) {
                        res.status(404).send("ID provided but player not found"); return;
                    } else {
                        delete req.body.metadata
                        delete req.body.register
                        delete req.body.license
                        player = Object.assign(player, req.body);
                        player.metadata.updated = Date.now();
                        db.players.set(player.id, player);
                        return res.status(200).send("Player updated");
                    }
                } else {
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
            }
        } else {
            next(401); return;
        }
    }
}