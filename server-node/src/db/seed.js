const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const { withTransaction } = require('../config/database');
const { initializeDatabase } = require('./init');

function formatErrorMessage(error) {
  if (error?.errors?.length) {
    return error.errors.map((item) => item.message).join('; ');
  }

  return error?.message || error?.code || String(error);
}

async function seedDatabase() {
  await initializeDatabase();

  await withTransaction(async (client) => {
    const email = 'demo@placeprep.dev';
    const passwordHash = await bcrypt.hash('Demo@12345', 12);

    const existingUserResult = await client.query(
      'SELECT id, username FROM users WHERE email = $1',
      [email]
    );

    let userId = existingUserResult.rows[0]?.id;

    if (!userId) {
      userId = randomUUID();
      await client.query(
        `INSERT INTO users (
          id,
          name,
          username,
          role,
          email,
          password_hash,
          weak_areas,
          target_role,
          placement_date,
          timezone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE + INTERVAL '30 days', $9)`,
        [
          userId,
          'Demo User',
          'demo',
          'admin',
          email,
          passwordHash,
          ['Dynamic Programming', 'Operating Systems', 'System Design'],
          'Backend Engineer',
          'Asia/Calcutta',
        ]
      );
    } else if (!existingUserResult.rows[0]?.username) {
      await client.query(
        'UPDATE users SET username = $1 WHERE id = $2',
        ['demo', userId]
      );
    }

    await client.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      ['admin', userId]
    );

    const taskCountResult = await client.query(
      'SELECT COUNT(*)::INT AS count FROM tasks WHERE user_id = $1',
      [userId]
    );

    if (taskCountResult.rows[0].count === 0) {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const tasks = [
        {
          title: 'Binary Tree Level Order Traversal',
          category: 'DSA',
          subcategory: 'Trees',
          status: 'completed',
          priority: 'high',
          intensity: 'medium',
          scheduledFor: today,
          estimatedMinutes: 35,
          actualMinutes: 38,
          weakArea: 'Trees',
          aiGenerated: true,
        },
        {
          title: 'Revise DBMS indexing and normalization',
          category: 'Core',
          subcategory: 'DBMS',
          status: 'in_progress',
          priority: 'medium',
          intensity: 'medium',
          scheduledFor: today,
          estimatedMinutes: 45,
          actualMinutes: 20,
          weakArea: 'DBMS',
          aiGenerated: false,
        },
        {
          title: 'Implement auth refresh flow for project',
          category: 'Project',
          subcategory: 'Auth',
          status: 'pending',
          priority: 'high',
          intensity: 'high',
          scheduledFor: tomorrow,
          estimatedMinutes: 60,
          actualMinutes: 0,
          weakArea: 'Backend APIs',
          aiGenerated: false,
        },
      ];

      for (const task of tasks) {
        await client.query(
          `INSERT INTO tasks (
            id,
            user_id,
            title,
            category,
            subcategory,
            status,
            priority,
            intensity,
            scheduled_for,
            estimated_minutes,
            actual_minutes,
            weak_area,
            ai_generated,
            completed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            randomUUID(),
            userId,
            task.title,
            task.category,
            task.subcategory,
            task.status,
            task.priority,
            task.intensity,
            task.scheduledFor,
            task.estimatedMinutes,
            task.actualMinutes,
            task.weakArea,
            task.aiGenerated,
            task.status === 'completed' ? new Date() : null,
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO user_profiles (
        id,
        user_id,
        linkedin_url,
        github_url,
        leetcode_url,
        portfolio_url
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO NOTHING`,
      [
        randomUUID(),
        userId,
        'https://www.linkedin.com/in/placeprep-demo',
        'https://github.com/placeprep-demo',
        'https://leetcode.com/u/placeprep-demo',
        'https://placeprep-demo.dev',
      ]
    );

    await client.query(
      `INSERT INTO daily_logs (
        id,
        user_id,
        log_date,
        summary,
        wins,
        blockers,
        mood,
        energy,
        productivity_score,
        focus_minutes,
        hours_studied,
        tasks_completed_count,
        notes,
        improvement_plan
      ) VALUES (
        $1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (user_id, log_date) DO NOTHING`,
      [
        randomUUID(),
        userId,
        'Covered one tree problem, revised DBMS, and shipped backend auth planning.',
        'Strong focus during the morning session.',
        'Need more confidence in normalization edge cases.',
        4,
        4,
        78,
        170,
        4.5,
        1,
        'Stay consistent with problem solving.',
        'Do one system design drill tomorrow.',
      ]
    );
  });
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Database seeded successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to seed database:', formatErrorMessage(error));
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
};
