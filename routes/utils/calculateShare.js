module.exports.getTransactionCode = function () {
	return (
		(Math.random() + " ").substring(2, 10) +
		(Math.random() + " ").substring(2, 10)
	);
};

module.exports.calculateShare = function (
	calculate,
	amount,
	rule,
	rule2 = {},
	sharerCode = ""
) {
	console.log(
		"**********Calculating " +
			calculate +
			" share for amount " +
			amount +
			" **********"
	);
	var bankFee = calculateFee(rule, amount);

	var infraShare = calculateInfraShare(rule, bankFee);

	var otherBankShare = calculateOtherBankShare(rule, bankFee);

	var bankBShare =
		otherBankShare.percentage_amount + otherBankShare.fixed_amount;

	var bankShare =
		bankFee - infraShare.percentage_amount - otherBankShare.percentage_amount;

	switch (calculate) {
		case "bank":
			console.log(rule);
			console.log("Bank Fee: ", bankFee);
			return bankFee;
		case "infra":
			console.log("Infra Share: ", infraShare);
			return infraShare;
		case "claimBranch":
			if (
				rule2.revenue_sharing_rule &&
				rule2.revenue_sharing_rule.branch_share
			) {
				rule = rule2;
				bankShare = bankBShare;
			}
			console.log(rule.revenue_sharing_rule.branch_share);
			console.log(rule.revenue_sharing_rule.specific_branch_share);
			var branchRule = rule.revenue_sharing_rule.branch_share;
			if (
				rule.revenue_sharing_rule.specific_branch_share &&
				rule.revenue_sharing_rule.specific_branch_share.length > 0
			) {
				var specificBranchRule = rule.revenue_sharing_rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.branch_code == sharerCode
				)[0];
			}
			if (specificBranchRule) {
				branchRule = specificBranchRule;
			}
			var { claim } = branchRule;
			var claimFee = (claim * bankShare) / 100;
			claimFee = Math.round((claimFee + Number.EPSILON) * 100) / 100;

			console.log("Bank Share: ", bankShare);
			console.log("Claiming Branch Share: ", claimFee);
			return claimFee;
		case "sendBranch":
			if (
				rule2.revenue_sharing_rule &&
				rule2.revenue_sharing_rule.branch_share
			) {
				rule = rule2;
			}
			console.log(rule.revenue_sharing_rule.branch_share);
			console.log(rule.revenue_sharing_rule.specific_branch_share);
			var branchRule1 = rule.revenue_sharing_rule.branch_share;
			if (
				rule.revenue_sharing_rule.specific_branch_share &&
				rule.revenue_sharing_rule.specific_branch_share.length > 0
			) {
				var specificBranchRule1 = rule.revenue_sharing_rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.branch_code == sharerCode
				)[0];
			}
			if (specificBranchRule1) {
				branchRule1 = specificBranchRule1;
			}
			var { send } = branchRule1;
			var sendFee = (Number(send) * bankShare) / 100;
			sendFee = Math.round((sendFee + Number.EPSILON) * 100) / 100;

			console.log("Bank Share: ", bankShare);
			console.log("Sending Branch Share: ", sendFee);
			return sendFee;
		case "claimPartner":
			if (
				rule2.revenue_sharing_rule &&
				rule2.revenue_sharing_rule.partner_share
			) {
				rule = rule2;
				bankShare = bankBShare;
			}
			console.log(rule.revenue_sharing_rule.partner_share);
			console.log(rule.revenue_sharing_rule.specific_partner_share);
			var partnerRule = rule.revenue_sharing_rule.partner_share;
			if (
				rule.revenue_sharing_rule.specific_partner_share &&
				rule.revenue_sharing_rule.specific_partner_share.length > 0
			) {
				var specificPartnerRule = rule.revenue_sharing_rule.specific_partner_share.filter(
					(specific_brule) => specific_brule.partner_code == sharerCode
				)[0];
			}
			if (specificPartnerRule) {
				partnerRule = specificPartnerRule;
			}
			var { claim1 } = partnerRule;
			var claimFee1 = (claim1 * bankShare) / 100;
			claimFee1 = Math.round((claimFee1 + Number.EPSILON) * 100) / 100;

			console.log("Bank Share: ", bankShare);
			console.log("Claiming Partner Share: ", claimFee1);
			return claimFee1;
		case "sendPartner":
			if (
				rule2.revenue_sharing_rule &&
				rule2.revenue_sharing_rule.partner_share
			) {
				rule = rule2;
			}
			console.log(rule.revenue_sharing_rule.partner_share);
			console.log(rule.revenue_sharing_rule.specific_partner_share);
			var partnerRule1 = rule.revenue_sharing_rule.partner_share;
			if (
				rule.revenue_sharing_rule.specific_partner_share &&
				rule.revenue_sharing_rule.specific_partner_share.length > 0
			) {
				var specificPartnerRule1 = rule.revenue_sharing_rule.specific_partner_share.filter(
					(specific_brule) => specific_brule.partner_code == sharerCode
				)[0];
			}
			if (specificPartnerRule1) {
				partnerRule1 = specificPartnerRule1;
			}
			var { send1 } = partnerRule1;
			var sendFee1 = (Number(send1) * bankShare) / 100;
			sendFee1 = Math.round((sendFee1 + Number.EPSILON) * 100) / 100;

			console.log("Bank Share: ", bankShare);
			console.log("Sending Partner Share: ", sendFee1);
			return sendFee1;
		case "branch":
			if (rule2.branch_share) {
				rule = rule2;
			}
			console.log(rule.branch_share);
			console.log(rule.specific_branch_share);
			var percent = rule.branch_share;
			if (rule.specific_branch_share && rule.specific_branch_share.length > 0) {
				var branchRule2 = rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.code == sharerCode
				)[0];
				if (branchRule2) {
					percent = branchRule2.percentage;
				}
			}
			var branchFee = (percent * bankShare) / 100;
			branchFee = Math.round((branchFee + Number.EPSILON) * 100) / 100;

			console.log("Bank Share: ", bankShare);
			console.log("Bank Branch Share : ", branchFee);
			return branchFee;
		case "partner":
			if (rule2.partner_share) {
				rule = rule2;
			}
			console.log(rule.partner_share);
			console.log(rule.specific_partner_share);
			var percent1 = rule.partner_share;
			if (
				rule.specific_partner_share &&
				rule.specific_partner_share.length > 0
			) {
				var partnerBRule = rule.specific_partner_share.filter(
					(specific_pbrule) => specific_pbrule.code == sharerCode
				)[0];
				if (partnerBRule) {
					percent1 = partnerBRule.percentage;
				}
			}
			var partnerFee = (percent1 * bankShare) / 100;
			partnerFee = Math.round((partnerFee + Number.EPSILON) * 100) / 100;

			console.log("Bank Share: ", bankShare);
			console.log("Merchant's Partner Branch Share: ", partnerFee);
			return partnerFee;
		case "claimBank":
			console.log("Other bank's share: ", otherBankShare);
			return otherBankShare;
	}
};

function calculateFee(rule, amount) {
	var ranges = rule.ranges;
	var bankRule = ranges.filter(
		(range) => amount >= range.trans_from && amount <= range.trans_to
	)[0];
	if (!bankRule) {
		return 0;
	}
	var temp = (amount * bankRule.percentage) / 100;
	var bankFee = temp + bankRule.fixed;
	return bankFee;
}

function calculateInfraShare(rule, bankFee) {
	var infra_share;
	if (rule.revenue_sharing_rule) {
		infra_share = rule.revenue_sharing_rule.infra_share;
	} else {
		infra_share = rule.infra_share;
	}
	var infraShare = {
		percentage_amount: 0,
		fixed_amount: 0,
	};
	infraShare.percentage_amount =
		(bankFee * Number(infra_share.percentage)) / 100;
	infraShare.fixed_amount = Number(infra_share.fixed);
	return infraShare;
}

function calculateOtherBankShare(rule, bankFee) {
	var otherBankShare = {
		percentage_amount: 0,
		fixed_amount: 0,
	};
	if (rule.other_bank_share && rule.other_bank_share.percentage > 0) {
		otherBankShare.percentage_amount =
			(bankFee * Number(rule.other_bank_share.percentage)) / 100;
	}
	if (rule.other_bank_share && rule.other_bank_share.fixed > 0) {
		otherBankShare.fixed_amount = Number(rule.other_bank_share.fixed);
	}
	return otherBankShare;
}
