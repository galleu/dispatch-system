module.exports = {
    path: '/logout',
    method: 'GET',
    handler: function (req, res, next, db) {
        if (req.session) {
            db.sessions.deleted(req.session.id)
        };
        // clear the session cookie
        res.clearCookie('session');
        return res.redirect(302, "/")
    }
}