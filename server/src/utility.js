module.exports = {

    getIpAddress(socket_request) {
        const s = socket_request;

        if (s && s.headers && s.headers["x-forwarded-for"])
            return s.headers["x-forwarded-for"].split(",").find(x => x).trim();

        if (s && s.socket && s.socket.remoteAddress)
            return s.socket.remoteAddress;

        return "unknown";
    }

};