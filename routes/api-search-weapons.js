module.exports = {
    path: '/api/search/weapons',
    method: 'GET',
    handler: function (req, res, next, db) {
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
    }
}