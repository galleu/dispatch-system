module.exports = {
    path: '/admin',
    method: 'GET',
    handler: function (req, res, next, db) {
        console.log("Admin Page View")
        if (req.session) {
            // Super Admins only 128
            if ((req.user.flags & 128) == 128) {
                // TODO: REMOVE ALL SENSITIVE DATA
                const users = db.users.getAll();
                res.render("admin", { users })
            } else {
                next([403, "You do not have permissions to access this page"])
            }
        } else {
            next()
        }
    }
}