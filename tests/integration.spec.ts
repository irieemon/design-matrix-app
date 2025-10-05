import { test, expect } from '@playwright/test';

test.describe('Integration Tests - Data Flow and Persistence', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to fully load
    await page.waitForLoadState('networkidle');

    // Clear any existing data for clean state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Complete Idea Lifecycle - Create, Edit, Position, Delete', async ({ page }) => {
    // Step 1: Create a new idea
    const addButton = page.locator('button:has-text("Add Idea")');
    if (await addButton.isVisible()) {
      await addButton.click();
    } else {
      // Alternative: Click on matrix to add idea
      await page.locator('.matrix-container').click();
    }

    // Fill in idea details (assuming modal or form appears)
    const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="idea"], textarea[placeholder*="idea"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Integration Test Idea');
    }

    // Submit the idea
    const submitButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Add")');
    if (await submitButton.isVisible()) {
      await submitButton.click();
    }

    // Wait for idea to appear in matrix
    await page.waitForTimeout(1000);

    // Verify idea appears in matrix
    const createdIdea = page.locator('text=Integration Test Idea').first();
    await expect(createdIdea).toBeVisible();

    // Step 2: Edit the idea
    await createdIdea.dblclick(); // Assuming double-click to edit

    const editInput = page.locator('input[value*="Integration"], textarea:has-text("Integration")').first();
    if (await editInput.isVisible()) {
      await editInput.clear();
      await editInput.fill('Updated Integration Test Idea');

      const saveEditButton = page.locator('button:has-text("Save"), button:has-text("Update")');
      if (await saveEditButton.isVisible()) {
        await saveEditButton.click();
      }
    }

    // Wait for update
    await page.waitForTimeout(500);

    // Verify idea content updated
    const updatedIdea = page.locator('text=Updated Integration Test Idea').first();
    await expect(updatedIdea).toBeVisible();

    // Step 3: Reposition the idea
    const initialPosition = await updatedIdea.boundingBox();

    await updatedIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 400, y: 300 }
    });

    await page.waitForTimeout(500);

    // Verify position changed
    const newPosition = await updatedIdea.boundingBox();
    expect(Math.abs(newPosition!.x - initialPosition!.x)).toBeGreaterThan(50);

    // Step 4: Verify persistence across page reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify idea still exists with updated content and position
    const persistedIdea = page.locator('text=Updated Integration Test Idea').first();
    await expect(persistedIdea).toBeVisible();

    const persistedPosition = await persistedIdea.boundingBox();
    expect(Math.abs(persistedPosition!.x - newPosition!.x)).toBeLessThan(20);

    // Step 5: Delete the idea
    await persistedIdea.click({ button: 'right' }); // Right-click for context menu

    const deleteButton = page.locator('button:has-text("Delete")');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion if confirmation dialog appears
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }

    await page.waitForTimeout(500);

    // Verify idea is removed
    await expect(page.locator('text=Updated Integration Test Idea')).not.toBeVisible();
  });

  test('Data Persistence - LocalStorage Integration', async ({ page }) => {
    // Create test data programmatically
    const testIdeas = [
      {
        id: 'persist-1',
        content: 'Persistence Test 1',
        matrix_position: { x: 0.3, y: 0.7 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      },
      {
        id: 'persist-2',
        content: 'Persistence Test 2',
        matrix_position: { x: 0.7, y: 0.3 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }
    ];

    // Set data in localStorage
    await page.evaluate((ideas) => {
      localStorage.setItem('ideas', JSON.stringify(ideas));
    }, testIdeas);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify data loads correctly
    await expect(page.locator('text=Persistence Test 1')).toBeVisible();
    await expect(page.locator('text=Persistence Test 2')).toBeVisible();

    // Modify one idea position
    const idea1 = page.locator('text=Persistence Test 1').first();
    await idea1.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 500, y: 400 }
    });

    await page.waitForTimeout(500);

    // Check that localStorage is updated
    const updatedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('ideas') || '[]');
    });

    expect(updatedData).toHaveLength(2);
    expect(updatedData[0].matrix_position.x).not.toBe(0.3); // Position should have changed
  });

  test('Error Handling - Corrupted Data Recovery', async ({ page }) => {
    // Set corrupted data in localStorage
    await page.evaluate(() => {
      localStorage.setItem('ideas', 'invalid-json-data');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should handle corrupted data gracefully
    await expect(page.locator('text=No ideas yet')).toBeVisible();

    // Should be able to add new ideas after corruption
    const addButton = page.locator('button:has-text("Add Idea")');
    if (await addButton.isVisible()) {
      await addButton.click();

      const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="idea"], textarea[placeholder*="idea"]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Recovery Test Idea');

        const submitButton = page.locator('button:has-text("Save"), button:has-text("Create")');
        if (await submitButton.isVisible()) {
          await submitButton.click();
        }
      }
    }

    await page.waitForTimeout(1000);

    // Verify new idea works after corruption recovery
    await expect(page.locator('text=Recovery Test Idea')).toBeVisible();

    // Verify localStorage is now valid
    const recoveredData = await page.evaluate(() => {
      const data = localStorage.getItem('ideas');
      try {
        return JSON.parse(data || '[]');
      } catch {
        return null;
      }
    });

    expect(recoveredData).not.toBeNull();
    expect(Array.isArray(recoveredData)).toBeTruthy();
  });

  test('Cross-Browser Data Consistency', async ({ page, browserName }) => {
    // Set test data
    const browserTestData = {
      id: `browser-test-${browserName}`,
      content: `Browser Test - ${browserName}`,
      matrix_position: { x: 0.5, y: 0.5 },
      created_at: new Date().toISOString(),
      user_id: 'test-user'
    };

    await page.evaluate((data) => {
      localStorage.setItem('ideas', JSON.stringify([data]));
    }, browserTestData);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify data loads consistently across browsers
    await expect(page.locator(`text=Browser Test - ${browserName}`)).toBeVisible();

    // Test drag functionality across browsers
    const idea = page.locator(`text=Browser Test - ${browserName}`).first();
    await idea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 300, y: 300 }
    });

    await page.waitForTimeout(500);

    // Verify position update works in all browsers
    const position = await idea.boundingBox();
    expect(position!.x).toBeGreaterThan(200);
    expect(position!.y).toBeGreaterThan(200);
  });

  test('State Management - Multiple Operations Sequence', async ({ page }) => {
    // Perform multiple rapid operations to test state consistency
    const operations = [
      { action: 'create', content: 'Rapid Op 1' },
      { action: 'create', content: 'Rapid Op 2' },
      { action: 'create', content: 'Rapid Op 3' }
    ];

    for (const op of operations) {
      const addButton = page.locator('button:has-text("Add Idea")');
      if (await addButton.isVisible()) {
        await addButton.click();

        const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="idea"], textarea[placeholder*="idea"]').first();
        if (await titleInput.isVisible()) {
          await titleInput.fill(op.content);

          const submitButton = page.locator('button:has-text("Save"), button:has-text("Create")');
          if (await submitButton.isVisible()) {
            await submitButton.click();
          }
        }
      }

      await page.waitForTimeout(300); // Brief pause between operations
    }

    // Verify all operations completed successfully
    await expect(page.locator('text=Rapid Op 1')).toBeVisible();
    await expect(page.locator('text=Rapid Op 2')).toBeVisible();
    await expect(page.locator('text=Rapid Op 3')).toBeVisible();

    // Verify state consistency
    const finalData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('ideas') || '[]');
    });

    expect(finalData).toHaveLength(3);
    expect(finalData.map((idea: any) => idea.content)).toContain('Rapid Op 1');
    expect(finalData.map((idea: any) => idea.content)).toContain('Rapid Op 2');
    expect(finalData.map((idea: any) => idea.content)).toContain('Rapid Op 3');
  });

  test('Concurrent User Simulation', async ({ page }) => {
    // Simulate concurrent operations by rapid user interactions
    await page.evaluate(() => {
      const testIdeas = [
        { id: '1', content: 'Concurrent Test 1', matrix_position: { x: 0.2, y: 0.8 }, created_at: new Date().toISOString(), user_id: 'user1' },
        { id: '2', content: 'Concurrent Test 2', matrix_position: { x: 0.8, y: 0.2 }, created_at: new Date().toISOString(), user_id: 'user2' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Simulate rapid concurrent operations
    const idea1 = page.locator('text=Concurrent Test 1').first();
    const idea2 = page.locator('text=Concurrent Test 2').first();

    // Start both drag operations quickly
    const [drag1, drag2] = await Promise.allSettled([
      idea1.dragTo(page.locator('.matrix-container'), { targetPosition: { x: 300, y: 300 } }),
      idea2.dragTo(page.locator('.matrix-container'), { targetPosition: { x: 400, y: 400 } })
    ]);

    await page.waitForTimeout(1000);

    // Verify both operations completed without conflicts
    expect(drag1.status).toBe('fulfilled');
    expect(drag2.status).toBe('fulfilled');

    // Check final positions are different (no collision)
    const pos1 = await idea1.boundingBox();
    const pos2 = await idea2.boundingBox();

    expect(Math.abs(pos1!.x - pos2!.x)).toBeGreaterThan(50);
    expect(Math.abs(pos1!.y - pos2!.y)).toBeGreaterThan(50);
  });

  test('Memory Management - Large Dataset Handling', async ({ page }) => {
    // Create a large dataset to test memory management
    const largeDataset = Array.from({ length: 100 }, (_, i) => ({
      id: `memory-test-${i}`,
      content: `Memory Test Idea ${i}`,
      matrix_position: { x: Math.random(), y: Math.random() },
      created_at: new Date().toISOString(),
      user_id: 'test-user'
    }));

    await page.evaluate((data) => {
      localStorage.setItem('ideas', JSON.stringify(data));
    }, largeDataset);

    // Measure memory usage during load
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify all ideas loaded
    const loadedIdeas = await page.locator('[data-testid^="idea-card-"]').count();
    expect(loadedIdeas).toBe(100);

    // Check memory usage after load
    const loadedMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Memory increase should be reasonable (less than 50MB for 100 ideas)
    const memoryIncrease = loadedMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB

    // Test performance of operations with large dataset
    const firstIdea = page.locator('text=Memory Test Idea 0').first();
    const startTime = Date.now();

    await firstIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 400, y: 400 }
    });

    const operationTime = Date.now() - startTime;

    // Operations should still be responsive (under 2 seconds)
    expect(operationTime).toBeLessThan(2000);
  });
});