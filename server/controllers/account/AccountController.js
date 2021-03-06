const service                        = require('@services/account/Service');
const {authenticate}                 = require('@middleware/authenticate');
const {logger}                       = require('@log/logger');
const {tracecodes}                   = require('@tracecodes');

module.exports.controller = (app) => {

    /**
     * This route is used to pull out the transactions for the
     * specified user. The user is identified based on the x-auth token
     * The transactions will be grouped by account_id
     *
     * @return {transactions} [user's transactions]
     */
    app.get('/user/transactions', authenticate, async (req, res) => {

        //
        // This is an async call, as we make an async API call,
        // we also make an async update call to the DB, if needed.
        //
        await service.refreshTokenIfExpired(req, res, req.token);

        // Fetch all accounts for the user
        req.accounts = await service.fetchAllUserAccounts(req, res);

        if (typeof req.accounts === 'undefined') {

            return;
        }

        const transactions = await service.getTransactionsResponse(req, res);

        res.json({"Transactions": transactions});
    });

    /**
     * This route is used to pull out the transactions saved in the DB, and
     * return the min, max and average of amounts grouped by transaction categories.
     *
     * @return {statistics} [User transaction stats]
     */
    app.get('/user/transactions/stats', authenticate, async (req, res) => {

        logger.info({
            code: tracecodes.CUSTOMER_ACCOUNT_STATS_REQUEST,
            url: req.originalUrl,
            user_id: req.user_id,
        });

        // We fetch transactions from redis,
        // and if redis is empty, we fetch the data from the DB
        const transactions = await service.getUserTransactions(req.user_id);

        if ((typeof transactions === 'undefined') ||
            ((typeof transactions !== 'undefined') &&
             (transactions.length === 0))) {

            // Return early if transactions are not saved in the DB
            service.handleTransactionsEmpty(req, res);

            return;
        }

        const statistics = service.getTxnCategoryStats(req, transactions);

        // Send response along with app_token
        res.setHeader('x-auth', req.token.app_token);
        res.json({"Statistics": statistics});
    });
};
