module.exports.getTransactionCode = function (data1, data2) {
	var slice1 = data1.slice(-2);
	var slice2 = data2.slice(-2);
	var now = new Date().getTime();
	return slice1 + "" + slice2 + "" + now;
};

module.exports.calculateShare = function (
	calculate,
	amount,
	rule,
	partnerCode = ""
) {
	console.log(rule);
	var ranges = rule.ranges;
	var bankRule = ranges.filter(
		(range) => amount >= range.trans_from && amount <= range.trans_to
	)[0];
	if (!bankRule) {
		return 0;
	}
	var temp = (amount * bankRule.percentage) / 100;
	var bankShare = temp + bankRule.fixed;
	switch (calculate) {
		case "bank":
			console.log("Bank Share: ", bankShare);
			return bankShare;
		case "infra":
			var temp = (bankShare * Number(rule.infra_share.percentage)) / 100;
			var infraShare = temp + Number(rule.infra_share.fixed);
			return infraShare;
		case "claimBranch":
			var branchRule = rule.branch_share;
			if (rule.specific_branch_share && rule.specific_branch_share.length > 0) {
				branchRule = rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.branch_code == partnerCode
				)[0];
			}
			var { claim } = branchRule;
			var claimFee = (claim * fee) / 100;
			console.log("Claiming Branch Share: ", claimFee);
			return claimFee;
		case "sendBranch":
			var branchRule = rule.branch_share;
			if (rule.specific_branch_share && rule.specific_branch_share.length > 0) {
				branchRule = rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.branch_code == partnerCode
				)[0];
			}
			var { send } = branchRule;
			var sendFee = (send * fee) / 100;
			console.log("Sending Branch Share: ", sendFee);
			return sendFee;
		case "partner":
			var percent = rule.partner_share_percentage;
			if (rule.specific_partners_share && rule.specific_partners_share.length > 0) {
				var partnerRule = rule.specific_partners_share.filter(
					(specific_prule) => specific_prule.code == partnerCode
				)[0];
				if (partnerRule) {
					percent = partnerRule.percentage;
				}
			}
			var partnerFee = (percent * bankShare) / 100;
			console.log("Merchant's Partner Share: ", partnerFee);
			return partnerFee;
		case "partnerBranch":
			var percent = rule.partner_branch_share;
			if (rule.specific_partners_branch_share && rule.specific_partners_branch_share.length > 0) {
				var partnerBRule = rule.specific_partners_branch_share.filter(
					(specific_pbrule) => specific_pbrule.code == partnerCode
				)[0];
				if (partnerBRule) {
					percent = partnerBRule.percentage;
				}
			}
			var partnerFee = (percent * bankShare) / 100;
			console.log("Merchant's Partner Branch Share: ", partnerFee);
			return partnerFee;
	}
};
