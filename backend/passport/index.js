const passport = require('passport');
const JWTStrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;
const db = require('../models');
let helper = require("../config/helper")
const User = db.users;
const opts = {};

opts.jwtFromRequest = ExtractJWT.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.JWT_SECRET;

passport.use('user', new JWTStrategy(opts,
    async function(payload, done) {
        try {
            console.log(payload, "-------payload--------");
            if (!payload.data.id) {
                return done(null, false);
            }
            const existingUser = await User.findOne({
                attributes: ['id', 'email', 'role', 'first_name', 'last_name'],
                where: {
                    id: payload.data.id,
                    email: payload.data.email
                }
            });
            if (existingUser) {
                console.log(existingUser.dataValues, '===============>loggedInUser');
                return done(null, existingUser.dataValues);
            }
            return done(null, false);
        } catch (e) {
            console.log(e);
            return done(null, false);
        }
    }
));

// Valid roles in the system
const VALID_ROLES = ['admin', 'deal_manager', 'analyst', 'viewer'];

// RBAC middleware - checks if user has one of the allowed roles
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return helper.unauth(res, 'Authentication required');
        }

        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions. Required role: ' + allowedRoles.join(' or ')
            });
        }

        next();
    };
};

// Convenience middleware for common role checks
const requireAdmin = requireRole('admin');
const requireDealManager = requireRole('admin', 'deal_manager');
const requireAnalyst = requireRole('admin', 'deal_manager', 'analyst');
const requireAnyRole = requireRole('admin', 'deal_manager', 'analyst', 'viewer');

module.exports = {
    initialize: function() {
        return passport.initialize();
    },
    authenticateUser: function(req, res, next) {
        return passport.authenticate("user", { session: false }, (err, user, info) => {
            if (err) return helper.unauth(res, err);

            if (info && info.hasOwnProperty('name') && info.name == 'JsonWebTokenError')
                return helper.unauth(res, 'Invalid Token.', {});
            else if (user == false)
                return helper.unauth(res, 'Invalid Token.', {});

            req.user = user;
            next();
        })(req, res, next);
    },
    // RBAC exports
    requireRole,
    requireAdmin,
    requireDealManager,
    requireAnalyst,
    requireAnyRole,
    VALID_ROLES
}