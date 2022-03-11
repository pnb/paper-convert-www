var passport = require('passport');
var Strategy = require('passport-local');
var crypto = require('crypto');
var db = require('./db').sql_engine;


module.exports = () => {
    // Check username and password, call cb with "false" if it fails, or user info on success
    // The user info will end up in req.user
    passport.use(new Strategy(function(username, password, cb) {
        db.get('SELECT rowid AS id, * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                return cb(err);
            }
            if (!row) {  // Don't think this message is actually used right now
                return cb(null, false, {message: 'Incorrect username or password'});
            }
            crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', (err, hashedPassword) => {
                if (err) {
                    return cb(err);
                }
                if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
                    return cb(null, false, {message: 'Incorrect username or password'});
                }
                var user = {
                    id: row.id.toString(),
                    username: row.username,
                    displayName: row.name
                }
                return cb(null, user);
            });
        });
    }));

    // Serialize and deserialize users when the session is saved/loaded
    passport.serializeUser((user, cb) => {
        process.nextTick(() => {
            cb(null, {id: user.id, username: user.username});
        });
    });

    passport.deserializeUser((user, cb) => {
        process.nextTick(() => {
            return cb(null, user);
        });
    });
}
