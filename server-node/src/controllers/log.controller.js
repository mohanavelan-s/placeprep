const logService = require('../services/log.service');

async function upsertLog(req, res) {
  const log = await logService.upsertLog(req.user, req.body);
  res.status(201).json({ success: true, data: log });
}

async function listLogs(req, res) {
  const logs = await logService.listLogs(req.user, req.query);
  res.json({ success: true, data: logs });
}

async function getTodayLog(req, res) {
  const log = await logService.getLogByDate(req.user, new Date());
  res.json({ success: true, data: log });
}

async function deleteLog(req, res) {
  const log = await logService.deleteLog(req.user, req.params.logId);
  res.json({ success: true, data: log });
}

module.exports = {
  upsertLog,
  listLogs,
  getTodayLog,
  deleteLog,
};
