module.exports = {
    path: '/api/registry/:type',
    method: 'POST',
    handler: function (req, res, next, db) {
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
                        serial: req.func.makeSerial(),
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
    }
}