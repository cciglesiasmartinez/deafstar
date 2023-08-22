/*
 * Configuration file
 *
 */

const conf = {
  admin: {
    username: "admin",
    password: "password",
    path: "/admin",
  },
  db: {
    name: "deafstar",
    user: "root",
    password: "password",
    host: "127.0.0.1",
  },
  server: {
    hostname: "localhost",
    port: 8008,
  },
};

module.exports = { conf };
