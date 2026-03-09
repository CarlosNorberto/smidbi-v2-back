const { sessionAuth } = require('../../auth/middleware');
const tasksLists = require('../../controllers/tasks/tasks_lists');
const tasksCards = require('../../controllers/tasks/tasks_cards');
const tasksTags = require('../../controllers/tasks/tasks_tags');

module.exports=(app)=>{
    
    // TASKS LISTS
    app.get(process.env.PREFIX_API + '/tasks_lists/report/all/:reportId', sessionAuth, tasksLists.getAllByReportId);

    // TASKS CARDS
    app.get(process.env.PREFIX_API + '/tasks_cards/:id', sessionAuth, tasksCards.getById);
    app.post(process.env.PREFIX_API + '/tasks_cards/save', sessionAuth, tasksCards.save);
    app.put(process.env.PREFIX_API + '/tasks_cards/update/:id', sessionAuth, tasksCards.update);

    // TASKS TAGS
    app.get(process.env.PREFIX_API + '/tasks_tags/all', sessionAuth, tasksTags.getAll);

}