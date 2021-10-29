module.exports = {
    path: '/api/registry/:type/:id',
    method: 'GET',
    handler: function (req, res, next, db) {
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
    }
}