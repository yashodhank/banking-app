const service                        = require('@services/account/Service');
const {authenticate}                 = require('@middleware/authenticate');
const {logger}                       = require('@log/logger');
const {tracecodes}                   = require('@tracecodes');

module.exports.controller = (app) => {

    /**
     * This route is used to pull out the transactions for the
     * specified user. The user is identified based on the x-auth token
     */
    app.get('/user/transactions', authenticate, async (req, res) => {

        //
        // This is an async call, as we make an async API call,
        // we also make an async update call to the DB, if needed.
        //
        req.token = await service.refreshTokenIfExpired(req, res, req.token);

        // Fetch all accounts for the user
        req.accounts = await service.fetchAllUserAccounts(req, res);

        if (typeof req.accounts === 'undefined') {

            return;
        }

        const transactions = await service.getTransactionsResponse(req, res);

        // If we weren't able to fetch transactions, we return early
        // TODO: Send all responses here
        if (typeof transactions === 'undefined') {

            return;
        }

        res.json({"Transactions": transactions});
    });

    /**
     * This route is used to pull out the transactions saved in the DB, and
     * return the min, max and average of amounts grouped by transaction categories.
     */
    app.get('/user/statistics', authenticate, async (req, res) => {

        logger.info({
            code: tracecodes.CUSTOMER_ACCOUNT_STATS_REQUEST,
            url: req.originalUrl,
            user_id: req.user_id,
        });

        // We fetch transactions from redis,
        // and if redis is empty, we fetch the data from the DB
        const transactions = await service.getUserTransactions(req.user_id);

        // TODO: Await must be in a try catch block
        if (typeof transactions === 'undefined' ||
            transactions.length === 0) {

            // Return early if transactions are not saved in the DB
            service.handleTransactionsEmpty(req, res);

            return;
        }

        // If txn length = 0, then we return a different response

        // Look into whether amounts are being tallied up correctly
        const responseObj = service.getTxnCategoryStats(req, transactions);

        // TODO: Don't cache the response in the browser, cache it in the app
        res.setHeader('x-auth', req.token.app_token);
        res.json({"Statistics": responseObj});
    });
};
