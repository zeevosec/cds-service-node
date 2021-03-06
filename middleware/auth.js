const FHIR = require("fhirclient");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const jwkToPem = require("jwk-to-pem");

const allowedIss = ["https://sandbox.cds-hooks.org"];

const authenticateEhr = async (req, res, next) => {
  const token = req.headers.authorization.replace("Bearer ", "");
  const decodedJwt = jwt.decode(token, { complete: true });
  const asymmetricAlgs = ["ES256", "ES384", "ES384", "RS256", "RS384", "RS512"];
  const { alg, jku, kid } = decodedJwt.header;
  const { iss } = decodedJwt.payload;

  const isAllowed = allowedIss.includes(iss);
  if (!isAllowed) {
    return res
      .status(401)
      .json("Authentication failed, iss {$iss} not allowed");
  }

  let pem;
  let verified;

  if (asymmetricAlgs.includes(alg)) {
    if (typeof jku !== "undefined") {
      // Generate public key with an jwks.json endpoint
      const jwks = await axios.get(jku);
      const targetJwk = jwks.data.keys.find((key) => key.kid === kid);

      pem = jwkToPem(targetJwk);
    } else {
      return res.status(401).json("Authentication failed, `jku` not defined!");
    }

    try {
      verified = jwt.verify(token, pem, { algorithms: [alg] });
    } catch (error) {
      console.error("Invalid Token Error", error.message);
      return res.status(401).json("Authentication failed");
    }
  }

  console.info("Token verified");
  return next();
};

const authenticateClient = async (req, res, next) => {
  const { fhirServer: serverUrl, fhirAuthorization } = req.body;

  req.fhirClient = new FHIR().client({ serverUrl });

  if (typeof fhirAuthorization === "undefined") {
    return next();
  }

  console.info("The token is : ", fhirAuthorization.access_token);
  req.fhirClient.tokenResponse = fhirAuthorization.access_token;

  return next();
};

module.exports = {
  authenticateEhr,
  authenticateClient,
};
