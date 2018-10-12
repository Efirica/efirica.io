const BigNumber = web3.BigNumber;
// const EVMRevert = require('./helpers/EVMRevert');

const time = require('./helpers/time');
const { advanceBlock } = require('./helpers/advanceToBlock');
const { ether } = require('./helpers/ether');

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

const Efirica = artifacts.require('Efirica');

contract('Efirica', function ([_, wallet1, wallet2, wallet3, wallet4, wallet5]) {
    beforeEach(async function () {
        await advanceBlock();
        this.efirica = await Efirica.new();
        this.startTime = await time.latest();
    });

    describe('deposit', function () {
        it('should work at least once', async function () {
            (await this.efirica.deposits.call(wallet1)).should.be.bignumber.equal(0);
            (await this.efirica.totalDeposits.call()).should.be.bignumber.equal(0);

            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });
            (await this.efirica.deposits.call(wallet1)).should.be.bignumber.equal(ether(1));
            (await this.efirica.totalDeposits.call()).should.be.bignumber.equal(ether(1));
        });

        it('should work at least twice from one address', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });
            (await this.efirica.deposits.call(wallet1)).should.be.bignumber.equal(ether(1));
            (await this.efirica.totalDeposits.call()).should.be.bignumber.equal(ether(1));

            await this.efirica.sendTransaction({ value: ether(2), from: wallet1 });
            (await this.efirica.deposits.call(wallet1)).should.be.bignumber.equal(ether(3));
            (await this.efirica.totalDeposits.call()).should.be.bignumber.equal(ether(3));
        });

        it('should work at least twice from different addresses', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });
            (await this.efirica.deposits.call(wallet1)).should.be.bignumber.equal(ether(1));
            (await this.efirica.deposits.call(wallet2)).should.be.bignumber.equal(0);
            (await this.efirica.totalDeposits.call()).should.be.bignumber.equal(ether(1));

            await this.efirica.sendTransaction({ value: ether(2), from: wallet2 });
            (await this.efirica.deposits.call(wallet1)).should.be.bignumber.equal(ether(1));
            (await this.efirica.deposits.call(wallet2)).should.be.bignumber.equal(ether(2));
            (await this.efirica.totalDeposits.call()).should.be.bignumber.equal(ether(3));
        });
    });

    describe('referral', function () {
        it('should receive increased dividends', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });
            (await this.efirica.percentsForUser.call(wallet1)).should.be.bignumber.equal(490);

            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            await this.efirica.sendTransaction({ value: ether(1), data: wallet1, from: wallet2 });
            (await this.efirica.percentsForUser.call(wallet1)).should.be.bignumber.equal(480);
            (await this.efirica.percentsForUser.call(wallet2)).should.be.bignumber.equal(528);

            await time.increaseTo(this.startTime + time.duration.days(2) + time.duration.seconds(1));

            const preBalance = await web3.eth.getBalance(wallet2);
            const { receipt } = await this.efirica.sendTransaction({ value: 0, from: wallet2 });
            const balance = await web3.eth.getBalance(wallet2);
            const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));

            const dividends = balance.sub(preBalance.sub(fee)).toNumber();
            dividends.should.be.closeTo(ether(1).mul(528).div(10000).toNumber(), ether(1).div(1000000).toNumber());
        });

        it('should not pay to first referral until 1 day', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });

            const referralBalance = await web3.eth.getBalance(wallet1);
            await this.efirica.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
            (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance);
        });

        it('should pay to first referral after 1 day', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            const referralBalance = await web3.eth.getBalance(wallet1);
            await this.efirica.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
            (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance.add(ether(1).mul(5).div(100)));
        });

        it('should pay to second referral after 2 days', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            await this.efirica.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(2) + time.duration.seconds(2));

            const referralBalance1 = await web3.eth.getBalance(wallet1);
            const referralBalance2 = await web3.eth.getBalance(wallet2);
            await this.efirica.sendTransaction({ value: ether(1), from: wallet3, data: wallet2 });
            (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance1.add(ether(1).mul(3).div(100)));
            (await web3.eth.getBalance(wallet2)).should.be.bignumber.equal(referralBalance2.add(ether(1).mul(5).div(100)));
        });

        it('should pay to third referral after 3 days', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            await this.efirica.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(2) + time.duration.seconds(2));

            await this.efirica.sendTransaction({ value: ether(1), from: wallet3, data: wallet2 });
            await time.increaseTo(this.startTime + time.duration.days(3) + time.duration.seconds(3));

            const referralBalance1 = await web3.eth.getBalance(wallet1);
            const referralBalance2 = await web3.eth.getBalance(wallet2);
            const referralBalance3 = await web3.eth.getBalance(wallet3);
            await this.efirica.sendTransaction({ value: ether(1), from: wallet4, data: wallet3 });
            (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance1.add(ether(1).mul(2).div(100)));
            (await web3.eth.getBalance(wallet2)).should.be.bignumber.equal(referralBalance2.add(ether(1).mul(3).div(100)));
            (await web3.eth.getBalance(wallet3)).should.be.bignumber.equal(referralBalance3.add(ether(1).mul(5).div(100)));
        });
    });

    describe('withdrawal', function () {
        it('should not work without deposit', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });

            const preBalance = await web3.eth.getBalance(wallet2);
            const { receipt } = await this.efirica.sendTransaction({ value: 0, from: wallet2 });
            const balance = await web3.eth.getBalance(wallet2);
            const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));

            balance.should.be.bignumber.equal(preBalance.sub(fee));
        });

        it('should work after deposit and 1 day wait', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.days(1));

            const preBalance = await web3.eth.getBalance(wallet1);
            const { receipt } = await this.efirica.sendTransaction({ value: 0, from: wallet1 });
            const balance = await web3.eth.getBalance(wallet1);
            const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));

            const dividends = balance.sub(preBalance.sub(fee)).toNumber();
            dividends.should.be.closeTo(ether(1).mul(49).div(1000).toNumber(), ether(1).div(1000000).toNumber());
        });

        it('should work after deposit and 1 hour wait', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.hours(1));

            const preBalance = await web3.eth.getBalance(wallet1);
            const { receipt } = await this.efirica.sendTransaction({ value: 0, from: wallet1 });
            const balance = await web3.eth.getBalance(wallet1);
            const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));

            const dividends = balance.sub(preBalance.sub(fee)).toNumber();
            dividends.should.be.closeTo(ether(1).div(24).mul(49).div(1000).toNumber(), ether(1).div(1000000).toNumber());
        });

        it('should work after deposit and 1 min wait', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.minutes(1));

            const preBalance = await web3.eth.getBalance(wallet1);
            const { receipt } = await this.efirica.sendTransaction({ value: 0, from: wallet1 });
            const balance = await web3.eth.getBalance(wallet1);
            const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));

            const dividends = balance.sub(preBalance.sub(fee)).toNumber();
            dividends.should.be.closeTo(ether(1).div(24 * 60).mul(49).div(1000).toNumber(), ether(1).div(1000000).toNumber());
        });

        it('should work after deposit and 5 day wait', async function () {
            await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.days(5));

            const preBalance = await web3.eth.getBalance(wallet1);
            const { receipt } = await this.efirica.sendTransaction({ value: 0, from: wallet1 });
            const balance = await web3.eth.getBalance(wallet1);
            const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));

            const dividends = balance.sub(preBalance.sub(fee)).toNumber();
            dividends.should.be.closeTo(ether(1).mul(5).mul(49).div(1000).toNumber(), ether(1).div(1000000).toNumber());
        });
    });

    it('should have the worst percents 0.5% after 100 days and 1 deposit', async function () {
        await this.efirica.sendTransaction({ value: ether(1), from: wallet1 });

        await time.increaseTo(this.startTime + time.duration.days(100));

        const preBalance = await web3.eth.getBalance(wallet1);
        const { receipt } = await this.efirica.sendTransaction({ value: 0, from: wallet1 });
        const balance = await web3.eth.getBalance(wallet1);
        const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));

        const dividends = balance.sub(preBalance.sub(fee)).toNumber();
        dividends.should.be.closeTo(ether(1).mul(99).div(100).toNumber(), ether(1).div(1000000).toNumber());

        (await this.efirica.generalPercents.call()).should.be.bignumber.equal(50);
    });
});
