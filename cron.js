const cron = require('node-cron');
const Cashier = require("./models/Cashier");
const DailyReport = require("./models/cashier/DailyReport");

corn.schedule('* 0 23 * * *', () => {
    Cashier.find({}).forEach(function(err, cashier) {
        let data = new DailyReport();
		data.cashier_id = cashier._id;
		data.branch_id = cashier.branch_id;
		data.bank_id = cashier.bank_id;
		data.created_at = new Date();
		data.user = "Cashier";
		data.note = '';
		data.paid_in_cash = cashier.cash_paid;
		data.cash_received = cashier.cash_received;
		data.fee_generated = cashier.fee_generated;
		data.comm_generated = cashier.commission_generated;
		data.opening_balance = cashier.opening_balance;
		data.closing_balance =  0;
		data.cash_in_hand = cashier.cash_in_hand;
		data.opening_time = cashier.opening_time;
		data.closing_time = new Date();
		data.descripency =  0 - cashier.cash_in_hand,
		data.save((err) => {
			if (err) {
				console.log(err);	
			} else {
				Cashier.findByIdAndUpdate(
						cashier._id,
						{
							closing_balance: total,
							closing_time: new Date(),
							is_closed: true,
						},
						function (e, v){}
				);
			}
        });
    });
})