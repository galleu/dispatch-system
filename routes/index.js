module.exports = {
    path: '/',
    method: 'GET',
    handler: function (req, res, next, db) {
        console.log("Req Session", req.session)
        if (req.session) {
            console.log("Index Request", req.session.user)
            // Make sure the user is logged in and has permission to view this page
            if ((req.user.flags & 2) == 2) {
                res.render("index", { user: req.user });
            } else {
                // If the user does not have permission to view this page, return a holding/error page
                res.render("error", {username: req.user.discord.username, message: "You are now waiting to be approved. You will get a message from staff when your account has been approved.", status: false})
            }
        } else {
            // If the user is not logged in, return the public landing page
            res.render("public"); return;
        }
    }
}