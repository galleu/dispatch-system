module.exports = {
    path: '/api/search/vehicles',
    method: 'GET',
    handler: function (req, res, next, db) {
        if (!req.session) {
            res.status(401).send("User not logged in");
            return;
        } else {
            if ((req.user.flags & 32) == 32) {
                const vehicles = db.registry.vehicles.getAll();
                if (req.query.plate) {
                    const results = vehicles.filter((vehicle) => (vehicle.plate.toLowerCase().includes(req.query.plate.toLowerCase()) && !vehicle.metadata.deleted));
                    res.status(200).send(results);
                } else if (req.query.make && req.query.model) {
                    const results = vehicles.filter((vehicle) => (vehicle.make.toLowerCase().includes(req.query.make.toLowerCase()) && vehicle.model.toLowerCase().includes(req.query.model.toLowerCase()) && !vehicle.metadata.deleted));
                    res.status(200).send(results);
                } else if (req.query.vin) {
                    const results = vehicles.filter((vehicle) => (vehicle.vin.toLowerCase().includes(req.query.vin.toLowerCase()) && !vehicle.metadata.deleted));
                    res.status(200).send(results);
                } else {
                    res.status(400).send("Missing Query"); return;
                }
            } else {
                res.status(401).send("Missing Permissions"); return;
            }
        }
    }
}