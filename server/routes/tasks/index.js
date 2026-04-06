const { sessionAuth } = require('../../auth/middleware');
const tasksLists = require('../../controllers/tasks/tasks_lists');
const tasksCards = require('../../controllers/tasks/tasks_cards');
const tasksTags = require('../../controllers/tasks/tasks_tags');
const tasksAds = require('../../controllers/tasks/tasks_ads');
const tasksActivities = require('../../controllers/tasks/tasks_activities');

module.exports=(app)=>{
    
    // TASKS LISTS
    app.get(process.env.PREFIX_API + '/tasks_lists/report/all', sessionAuth, tasksLists.getAll);
    app.get(process.env.PREFIX_API + '/tasks_lists/report/all/:reportId', sessionAuth, tasksLists.getAll);

    // TASKS CARDS
    app.get(process.env.PREFIX_API + '/tasks_cards/:id', sessionAuth, tasksCards.getById);
    app.post(process.env.PREFIX_API + '/tasks_cards/save', sessionAuth, tasksCards.save);
    app.put(process.env.PREFIX_API + '/tasks_cards/update/:id', sessionAuth, tasksCards.update);
    app.delete(process.env.PREFIX_API + '/tasks_cards/:id', sessionAuth, tasksCards.remove);

    // TASKS TAGS
    app.get(process.env.PREFIX_API + '/tasks_tags/all', sessionAuth, tasksTags.getAll);

    // TASKS ADS
    app.get(process.env.PREFIX_API + '/tasks_ads/:card_id/:report_id', sessionAuth, tasksAds.getByCardId);
    app.post(process.env.PREFIX_API + '/tasks_ads/save', sessionAuth, tasksAds.saveUpdate);
    app.delete(process.env.PREFIX_API + '/tasks_ads/:card_id', sessionAuth, tasksAds.deleteByCardId);

    // TASKS ACTIVITIES
    app.get(process.env.PREFIX_API + '/tasks_activities/card/:card_id', sessionAuth, tasksActivities.getAllByCardId);
}