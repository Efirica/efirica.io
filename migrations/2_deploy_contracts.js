const Efirica = artifacts.require('Efirica');

module.exports = async function (deployer) {
    deployer.deploy(Efirica);
};
