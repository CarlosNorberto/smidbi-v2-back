const { sessionAuth } = require('../../auth/middleware');
const tasksLists = require('../../controllers/tasks/tasks_lists');
const tasksCards = require('../../controllers/tasks/tasks_cards');
const tasksTags = require('../../controllers/tasks/tasks_tags');
const tasksAds = require('../../controllers/tasks/tasks_ads');
const tasksActivities = require('../../controllers/tasks/tasks_activities');
const { reportTasksAccess, newCardAccess, cardAccess } = require('../../auth/tasks_access');

module.exports=(app)=>{
    
    // TASKS LISTS
    app.get(process.env.PREFIX_API + '/tasks_lists/report/all', sessionAuth, tasksLists.getAll);
    app.get(process.env.PREFIX_API + '/tasks_lists/report/all/:reportId', sessionAuth, reportTasksAccess, tasksLists.getAll);

    // TASKS CARDS
    // Ruta literal antes de la dinámica ':id', porque ':id' también matchearía 'assigned_to_me'
    app.get(process.env.PREFIX_API + '/tasks_cards/assigned_to_me', sessionAuth, tasksCards.getAssignedToMe);
    app.put(process.env.PREFIX_API + '/tasks_cards/assigned_to_me/read_all', sessionAuth, tasksCards.markAllAssignedAsRead);
    app.put(process.env.PREFIX_API + '/tasks_cards/assigned_to_me/:cardId/read', sessionAuth, tasksCards.markAssignedAsRead);
    app.get(process.env.PREFIX_API + '/tasks_cards/:id', sessionAuth, cardAccess, tasksCards.getById);
    app.get(process.env.PREFIX_API + '/tasks_cards/:id/notify_preview', sessionAuth, cardAccess, tasksCards.notifyPreview);
    app.post(process.env.PREFIX_API + '/tasks_cards/:id/notify', sessionAuth, cardAccess, tasksCards.notifyResponsibles);
    app.post(process.env.PREFIX_API + '/tasks_cards/save', sessionAuth, newCardAccess, tasksCards.save);
    app.put(process.env.PREFIX_API + '/tasks_cards/update/:id', sessionAuth, cardAccess, tasksCards.update);
    app.delete(process.env.PREFIX_API + '/tasks_cards/:id', sessionAuth, cardAccess, tasksCards.remove);

    // TASKS TAGS
    app.get(process.env.PREFIX_API + '/tasks_tags/all', sessionAuth, tasksTags.getAll);

    // TASKS ADS
    app.get(process.env.PREFIX_API + '/tasks_ads/:card_id/:report_id', sessionAuth, cardAccess, tasksAds.getByCardId);
    app.post(process.env.PREFIX_API + '/tasks_ads/save', sessionAuth, cardAccess, tasksAds.saveUpdate);
    app.delete(process.env.PREFIX_API + '/tasks_ads/:card_id', sessionAuth, cardAccess, tasksAds.deleteByCardId);

    // TASKS ACTIVITIES
    app.get(process.env.PREFIX_API + '/tasks_activities/card/:card_id', sessionAuth, cardAccess, tasksActivities.getAllByCardId);
}