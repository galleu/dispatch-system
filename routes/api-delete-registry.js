module.exports = {
    path: '/api/registry/:type/:id',
    method: 'DELETE',
    handler: function (req, res, next, db) {
        if (!req.session) { res.status(401).send("User not logged in"); return; }
        if ((req.user.flags & 2) == 2) {
            if (req.params.type === 'weapons') {
                next([400, "You can not delete weapons registry"]);
            } else if (req.params.type === 'vehicles') {
                let vehicle = db.registry.vehicles.get(req.params.id);
                if (!vehicle) {
                    res.status(404).send("Vehicle not found");
                    return;
                } else {
                    vehicle.metadata.deleted = true;
                    vehicle.metadata.updated = +new Date();
                    db.registry.vehicles.update(req.params.id, vehicle);
                    res.status(200).send(vehicle);
                }
            } else {
                res.status(400).send("Invalid registry");
                return;
            }
        }
        
    }
}