module.exports.allTxSuccess = function (txInfo) {
	try {
		for (childtx of txInfo.childTx) {
			if (childtx.state == 0) {
				return false;
			}
		}
		return true;
	} catch (err) {
		throw err;
	}
};

module.exports.getPart = function (txInfo, masterId, childIds, otherIds) {
	let myPart = 0;
	let othersPart = 0;
	for (childtx of txInfo.childTx) {
		for (childId of childIds) {
			if (childtx.transaction.child_code == masterId + "-" + childId) {
				myPart += childtx.transaction.amount;
			}
		}
	}

	if (otherIds.length > 0) {
		for (childtx of txInfo.childTx) {
			for (otherId of otherIds) {
				if (childtx.transaction.child_code == masterId + "-" + otherId) {
					othersPart += childtx.transaction.amount;
				}
			}
		}
	}

	return myPart - othersPart;
};
