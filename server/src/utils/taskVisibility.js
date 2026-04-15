function buildPrepArchitectTaskVisibilityClause({
  taskRef = 'tasks',
  activePlanRef = "''",
  includeInactiveCompleted = false,
} = {}) {
  const sourceRef = `COALESCE(${taskRef}.metadata->>'source', '')`;
  const planRef = `COALESCE(${taskRef}.metadata->>'planId', '')`;
  const completedClause = includeInactiveCompleted ? ` OR ${taskRef}.status = 'completed'` : '';

  return `(
    ${sourceRef} <> 'prep-architect'
    OR ${planRef} = ${activePlanRef}
    ${completedClause}
  )`;
}

module.exports = {
  buildPrepArchitectTaskVisibilityClause,
};
