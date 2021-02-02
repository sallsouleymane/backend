module.exports = function (user, userCode, bankCode) {
    switch (user) {
        case "bank":
            return {
                operational: "BAO@" + userCode + "@" + bankCode,
                master: "BAM@" + userCode + "@" + bankCode,
                escrow: "BAE@" + userCode + "@" + bankCode,
            }
        case "infra":
            return {
                operational: "INO@" + userCode + "@" + bankCode,
                master: "INM@" + userCode + "@" + bankCode,
            }
        case "branch":
            return {
                operational: "BRO@" + userCode + "@" + bankCode,
                master: "BRM@" + userCode + "@" + bankCode,
            }
        case "partner":
            return {
                operational: "PAO@" + userCode + "@" + bankCode,
                master: "PAM@" + userCode + "@" + bankCode,
            }
        case "partnerBranch":
            return {
                operational: "PBO@" + userCode + "@" + bankCode,
                master: "PBM@" + userCode + "@" + bankCode,
            }
        case "merchant":
            return {
                operational: "MEO@" + userCode + "@" + bankCode,
                master: "MEM@" + userCode + "@" + bankCode,
            }
        case "infraMerchant":
            return {
                operational: "IMO@" + userCode + "@" + bankCode,
                master: "IMM@" + userCode + "@" + bankCode,
            }
        case user:
            return userCode + "@" + bankCode;
        default:
            return null;
    }

}