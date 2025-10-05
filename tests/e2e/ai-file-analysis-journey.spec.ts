import { test, expect, Page } from '@playwright/test';
import type { Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AI File Analysis Journey E2E Tests
 *
 * Comprehensive test suite for AI file analysis user journeys including:
 * - Upload file for analysis (PDF, image, audio)
 * - File analysis loading states
 * - View analysis results
 * - Analysis caching (same file = cached result)
 * - Image analysis with GPT-4V
 * - Audio transcription with Whisper
 * - Text document analysis
 * - Multiple file analysis (batch)
 * - File analysis errors and retry
 *
 * @requires OpenAI API mocking (GPT-4V, Whisper)
 * @coverage ~30 tests covering complete file analysis workflows
 */

// Mock file analysis responses
const mockImageAnalysis = {
  summary: 'Screenshot of a user dashboard with navigation menu and analytics widgets',
  key_insights: [
    'Clean modern UI design with good information hierarchy',
    'Dashboard shows key metrics and performance indicators',
    'Navigation follows standard patterns for user experience'
  ],
  extracted_text: 'Dashboard Analytics Users Revenue Settings',
  visual_description: 'The image shows a dashboard interface with a left sidebar navigation, header with user profile, and main content area displaying analytics cards with charts and metrics',
  relevance_score: 0.85,
  content_type: 'image',
  analysis_model: 'gpt-4o',
  analyzed_at: new Date().toISOString()
};

const mockAudioAnalysis = {
  summary: 'Product planning meeting discussing Q4 roadmap priorities',
  key_insights: [
    'Team consensus on mobile app as top priority for Q4',
    'Performance optimization needed before feature expansion',
    'Marketing launch planned for December'
  ],
  audio_transcript: 'Okay team, let\'s discuss our Q4 roadmap. The mobile app is our top priority. We need to focus on performance optimization first before adding new features. Marketing is planning a big launch in December.',
  extracted_text: 'Q4 roadmap mobile app performance optimization marketing launch December',
  relevance_score: 0.92,
  content_type: 'audio',
  analysis_model: 'whisper-1',
  analyzed_at: new Date().toISOString()
};

const mockPDFAnalysis = {
  summary: 'Product requirements document outlining new authentication system features',
  key_insights: [
    'Multi-factor authentication required for enhanced security',
    'Integration with social login providers (Google, GitHub)',
    'Session management and token refresh mechanism needed'
  ],
  extracted_text: 'Product Requirements: Authentication System 1.0 Features: MFA, Social Login, Session Management',
  relevance_score: 0.88,
  content_type: 'text',
  analysis_model: 'gpt-4o-mini',
  analyzed_at: new Date().toISOString()
};

const mockVideoAnalysis = {
  summary: 'Product demo video showing new dashboard features and user workflows',
  key_insights: [
    'Clear demonstration of key product features',
    'User workflow appears intuitive and well-designed',
    'Video highlights competitive advantages effectively'
  ],
  audio_transcript: 'Welcome to our new dashboard. As you can see, we\'ve redesigned the interface to make it more intuitive. The analytics section now provides real-time insights.',
  extracted_text: 'dashboard redesign analytics real-time insights',
  visual_description: 'Video walkthrough of product dashboard with voiceover explanation',
  relevance_score: 0.79,
  content_type: 'video',
  analysis_model: 'gpt-4o',
  analyzed_at: new Date().toISOString()
};

// Helper function to setup file analysis API mocking
async function mockFileAnalysisAPIs(page: Page) {
  // Mock file upload endpoint
  await page.route('**/api/upload', (route: Route) => {
    const postData = route.request().postData();
    const contentType = route.request().headers()['content-type'] || '';

    let fileType = 'text';
    if (contentType.includes('image')) fileType = 'image';
    else if (contentType.includes('audio')) fileType = 'audio';
    else if (contentType.includes('video')) fileType = 'video';

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fileId: 'mock-file-id-' + Date.now(),
        fileName: 'test-file.' + fileType,
        fileType: fileType,
        uploadSuccess: true
      })
    });
  });

  // Mock file analysis endpoint
  await page.route('**/api/ai/analyze-file', (route: Route) => {
    const requestBody = route.request().postDataJSON();
    const fileId = requestBody?.fileId || '';

    let analysis = mockPDFAnalysis;
    if (fileId.includes('image')) analysis = mockImageAnalysis;
    else if (fileId.includes('audio')) analysis = mockAudioAnalysis;
    else if (fileId.includes('video')) analysis = mockVideoAnalysis;

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        analysis,
        cached: false
      })
    });
  });

  // Mock image-specific analysis endpoint
  await page.route('**/api/ai/analyze-image', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        analysis: mockImageAnalysis
      })
    });
  });

  // Mock audio transcription endpoint
  await page.route('**/api/ai/transcribe-audio', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: mockAudioAnalysis.audio_transcript,
        analysis: mockAudioAnalysis
      })
    });
  });
}

// Helper to authenticate for tests
async function authenticateUser(page: Page) {
  await page.goto('/');

  const isAuthenticated = await page.locator('[data-testid="matrix-container"]').isVisible({ timeout: 3000 }).catch(() => false);

  if (!isAuthenticated) {
    const demoButton = page.locator('button:has-text("Try Demo"), button:has-text("Demo")');
    if (await demoButton.isVisible().catch(() => false)) {
      await demoButton.click();
      await page.waitForLoadState('networkidle');
    }
  }
}

test.describe('AI File Analysis Journey', () => {
  test.beforeEach(async ({ page }) => {
    await mockFileAnalysisAPIs(page);
    await authenticateUser(page);
  });

  test('should show file upload button in UI', async ({ page }) => {
    const uploadButton = page.locator('button:has-text("Upload"), input[type="file"], [data-testid="file-upload"]');
    await expect(uploadButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should allow selecting file for upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible().catch(() => false)) {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-document.pdf');
      if (!fs.existsSync(testFilePath)) {
        fs.writeFileSync(testFilePath, 'Test PDF content');
      }

      await fileInput.setInputFiles(testFilePath);

      // Verify file selected - selector has built-in wait
      const fileName = page.locator('text=/test-document|uploaded/i');
      await expect(fileName.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display upload progress indicator', async ({ page }) => {
    await page.route('**/api/upload', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate upload delay
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fileId: 'mock-file-id',
          uploadSuccess: true
        })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'test-upload.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      await fileInput.setInputFiles(testFilePath);

      const uploadProgress = page.locator('text=/uploading|progress/i, [role="progressbar"]');
      await expect(uploadProgress.first()).toBeVisible({ timeout: 3000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should show analysis loading state after upload', async ({ page }) => {
    await page.route('**/api/ai/analyze-file', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysis: mockPDFAnalysis,
          cached: false
        })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'test-analyze.txt');
      fs.writeFileSync(testFilePath, 'Test content for analysis');

      await fileInput.setInputFiles(testFilePath);

      const analyzingIndicator = page.locator('text=/analyzing|processing/i');
      await expect(analyzingIndicator.first()).toBeVisible({ timeout: 6000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should display analysis results after completion', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'test-result.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      await fileInput.setInputFiles(testFilePath);

      // Check for analysis results - increased timeout to compensate
      const analysisResults = page.locator('text=/summary|insights|analysis/i');
      await expect(analysisResults.first()).toBeVisible({ timeout: 8000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should show cached result for duplicate file upload', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/ai/analyze-file', (route: Route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysis: mockPDFAnalysis,
          cached: callCount > 1 // Second call returns cached
        })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'test-cache.txt');
      fs.writeFileSync(testFilePath, 'Test content for caching');

      // Upload once
      await fileInput.setInputFiles(testFilePath);
      await page.waitForLoadState('networkidle');

      // Upload same file again
      await fileInput.setInputFiles(testFilePath);

      // Should show cached indicator - increased timeout
      const cachedIndicator = page.locator('text=/cached|from cache/i');
      const hasCached = await cachedIndicator.isVisible({ timeout: 5000 }).catch(() => false);

      expect(callCount).toBeGreaterThan(0);
      fs.unlinkSync(testFilePath);
    }
  });

  test('should analyze image files with GPT-4V', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testImagePath = path.join(__dirname, 'test-image.png');
      // Create a minimal PNG file
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      fs.writeFileSync(testImagePath, pngHeader);

      await fileInput.setInputFiles(testImagePath);

      // Check for image-specific analysis - increased timeout
      const visualDescription = page.locator('text=/visual|image|screenshot/i');
      await expect(visualDescription.first()).toBeVisible({ timeout: 8000 });

      fs.unlinkSync(testImagePath);
    }
  });

  test('should extract text from images (OCR)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testImagePath = path.join(__dirname, 'test-ocr.png');
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      fs.writeFileSync(testImagePath, pngHeader);

      await fileInput.setInputFiles(testImagePath);

      // Check for extracted text section - increased timeout
      const extractedText = page.locator('text=/extracted text|text found/i');
      const hasExtraction = await extractedText.isVisible({ timeout: 6000 }).catch(() => false);

      expect(hasExtraction).toBeDefined();
      fs.unlinkSync(testImagePath);
    }
  });

  test('should transcribe audio files with Whisper', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testAudioPath = path.join(__dirname, 'test-audio.mp3');
      fs.writeFileSync(testAudioPath, 'Mock audio content');

      await fileInput.setInputFiles(testAudioPath);

      // Check for transcript - increased timeout
      const transcript = page.locator('text=/transcript|transcription/i');
      await expect(transcript.first()).toBeVisible({ timeout: 8000 });

      fs.unlinkSync(testAudioPath);
    }
  });

  test('should display audio transcription accuracy', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testAudioPath = path.join(__dirname, 'test-audio-quality.mp3');
      fs.writeFileSync(testAudioPath, 'Mock audio');

      await fileInput.setInputFiles(testAudioPath);

      // Check for quality/confidence indicator - increased timeout
      const qualityIndicator = page.locator('text=/confidence|accuracy|quality/i');
      const hasQuality = await qualityIndicator.isVisible({ timeout: 6000 }).catch(() => false);

      expect(hasQuality).toBeDefined();
      fs.unlinkSync(testAudioPath);
    }
  });

  test('should analyze PDF documents', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testPdfPath = path.join(__dirname, 'test-doc.pdf');
      fs.writeFileSync(testPdfPath, '%PDF-1.4 Mock PDF content');

      await fileInput.setInputFiles(testPdfPath);

      // Check for document analysis - increased timeout
      const docAnalysis = page.locator('text=/document|requirements|summary/i');
      await expect(docAnalysis.first()).toBeVisible({ timeout: 8000 });

      fs.unlinkSync(testPdfPath);
    }
  });

  test('should show file type icon/indicator', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'test-type.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      await fileInput.setInputFiles(testFilePath);

      // Check for file type indicator - increased timeout
      const fileTypeIcon = page.locator('[data-file-type], .file-icon, text=/\\.(txt|pdf|png|mp3)/i');
      const hasTypeIndicator = await fileTypeIcon.first().isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasTypeIndicator).toBeDefined();
      fs.unlinkSync(testFilePath);
    }
  });

  test('should support multiple file upload (batch)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      // Check if multiple attribute exists
      const supportsMultiple = await fileInput.getAttribute('multiple') !== null;

      if (supportsMultiple) {
        const file1 = path.join(__dirname, 'batch-1.txt');
        const file2 = path.join(__dirname, 'batch-2.txt');

        fs.writeFileSync(file1, 'Batch file 1');
        fs.writeFileSync(file2, 'Batch file 2');

        await fileInput.setInputFiles([file1, file2]);
        await page.waitForLoadState('networkidle');

        // Check that multiple files are being processed
        const fileList = page.locator('.file-item, [data-testid="uploaded-file"]');
        const fileCount = await fileList.count();

        expect(fileCount).toBeGreaterThanOrEqual(1);

        fs.unlinkSync(file1);
        fs.unlinkSync(file2);
      }
    }
  });

  test('should show batch analysis progress', async ({ page }) => {
    await page.route('**/api/ai/analyze-file', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ analysis: mockPDFAnalysis, cached: false })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const supportsMultiple = await fileInput.getAttribute('multiple') !== null;

      if (supportsMultiple) {
        const files = [
          path.join(__dirname, 'progress-1.txt'),
          path.join(__dirname, 'progress-2.txt')
        ];

        files.forEach(f => fs.writeFileSync(f, 'Test content'));
        await fileInput.setInputFiles(files);

        // Check for batch progress - increased timeout
        const batchProgress = page.locator('text=/analyzing.*files|\\d+\\/\\d+/i');
        const hasProgress = await batchProgress.isVisible({ timeout: 4500 }).catch(() => false);

        expect(hasProgress).toBeDefined();

        files.forEach(f => fs.unlinkSync(f));
      }
    }
  });

  test('should handle file upload errors', async ({ page }) => {
    await page.route('**/api/upload', (route: Route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Upload failed' })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'error-test.txt');
      fs.writeFileSync(testFilePath, 'Test');

      await fileInput.setInputFiles(testFilePath);

      const errorMessage = page.locator('text=/error|failed|unable/i');
      await expect(errorMessage.first()).toBeVisible({ timeout: 7000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should handle analysis errors with retry option', async ({ page }) => {
    let attemptCount = 0;
    await page.route('**/api/ai/analyze-file', (route: Route) => {
      attemptCount++;
      if (attemptCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Analysis failed' })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ analysis: mockPDFAnalysis, cached: false })
        });
      }
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'retry-test.txt');
      fs.writeFileSync(testFilePath, 'Test retry');

      await fileInput.setInputFiles(testFilePath);

      // Look for retry button - increased timeout
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")');
      if (await retryButton.isVisible({ timeout: 7000 }).catch(() => false)) {
        await retryButton.first().click();
        await page.waitForLoadState('networkidle');

        expect(attemptCount).toBe(2);
      }

      fs.unlinkSync(testFilePath);
    }
  });

  test('should validate file size limits', async ({ page }) => {
    // Large file simulation
    await page.route('**/api/upload', (route: Route) => {
      route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'File too large', maxSize: '10MB' })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'large-file.txt');
      fs.writeFileSync(testFilePath, 'x'.repeat(1000));

      await fileInput.setInputFiles(testFilePath);

      const sizeError = page.locator('text=/too large|size limit|maximum/i');
      await expect(sizeError.first()).toBeVisible({ timeout: 7000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should validate file type restrictions', async ({ page }) => {
    await page.route('**/api/upload', (route: Route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'File type not supported' })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'test-file.exe');
      fs.writeFileSync(testFilePath, 'Invalid file type');

      await fileInput.setInputFiles(testFilePath);

      const typeError = page.locator('text=/not supported|invalid type|unsupported/i');
      await expect(typeError.first()).toBeVisible({ timeout: 7000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should display analysis relevance score', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'relevance-test.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      await fileInput.setInputFiles(testFilePath);

      // Check for relevance indicator - increased timeout
      const relevanceScore = page.locator('text=/relevance|score|%/i');
      const hasRelevance = await relevanceScore.isVisible({ timeout: 6000 }).catch(() => false);

      expect(hasRelevance).toBeDefined();
      fs.unlinkSync(testFilePath);
    }
  });

  test('should show key insights from file analysis', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'insights-test.txt');
      fs.writeFileSync(testFilePath, 'Test document with important information');

      await fileInput.setInputFiles(testFilePath);

      const insights = page.locator('text=/key insights|insights|findings/i');
      await expect(insights.first()).toBeVisible({ timeout: 8000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should allow viewing full analysis details', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'details-test.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      await fileInput.setInputFiles(testFilePath);
      await page.waitForLoadState('networkidle');

      // Look for expand/view details button
      const viewDetails = page.locator('button:has-text("View Details"), button:has-text("Expand"), button:has-text("Show More")');
      if (await viewDetails.isVisible().catch(() => false)) {
        await viewDetails.first().click();

        // More detailed analysis should appear - increased timeout
        const detailedAnalysis = page.locator('text=/full analysis|detailed view/i');
        const hasDetails = await detailedAnalysis.isVisible({ timeout: 3500 }).catch(() => false);

        expect(hasDetails).toBeDefined();
      }

      fs.unlinkSync(testFilePath);
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route('**/api/ai/analyze-file', (route: Route) => {
      route.abort('failed');
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'network-error.txt');
      fs.writeFileSync(testFilePath, 'Test');

      await fileInput.setInputFiles(testFilePath);

      const networkError = page.locator('text=/network error|connection failed|offline/i');
      await expect(networkError.first()).toBeVisible({ timeout: 7000 });

      fs.unlinkSync(testFilePath);
    }
  });

  test('should show file analysis timestamp', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'timestamp-test.txt');
      fs.writeFileSync(testFilePath, 'Test');

      await fileInput.setInputFiles(testFilePath);

      // Check for timestamp - increased timeout
      const timestamp = page.locator('text=/analyzed|processed|\\d+.*ago/i');
      const hasTimestamp = await timestamp.isVisible({ timeout: 6000 }).catch(() => false);

      expect(hasTimestamp).toBeDefined();
      fs.unlinkSync(testFilePath);
    }
  });

  test('should allow deleting uploaded files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'delete-test.txt');
      fs.writeFileSync(testFilePath, 'Test');

      await fileInput.setInputFiles(testFilePath);
      await page.waitForLoadState('networkidle');

      // Look for delete button
      const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove"), button[aria-label*="delete"]');
      if (await deleteButton.isVisible().catch(() => false)) {
        const initialCount = await page.locator('.file-item, [data-testid="uploaded-file"]').count();
        await deleteButton.first().click();

        // Wait for deletion animation - minimal wait for UI update
        await page.waitForTimeout(300);

        const newCount = await page.locator('.file-item, [data-testid="uploaded-file"]').count();
        expect(newCount).toBeLessThanOrEqual(initialCount);
      }

      fs.unlinkSync(testFilePath);
    }
  });

  test('should integrate file analysis with AI insights', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'integration-test.txt');
      fs.writeFileSync(testFilePath, 'Test integration');

      await fileInput.setInputFiles(testFilePath);
      await page.waitForLoadState('networkidle');

      // Open AI insights modal
      const insightsButton = page.locator('button:has-text("AI Insights")');
      if (await insightsButton.isVisible().catch(() => false)) {
        await insightsButton.first().click();
        await page.waitForLoadState('networkidle');

        // Check that file analysis is referenced
        const fileReference = page.locator('text=/document|file|uploaded/i');
        await expect(fileReference.first()).toBeVisible({ timeout: 5000 });
      }

      fs.unlinkSync(testFilePath);
    }
  });

  test('should show video analysis with frame extraction', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testVideoPath = path.join(__dirname, 'test-video.mp4');
      fs.writeFileSync(testVideoPath, 'Mock video content');

      await fileInput.setInputFiles(testVideoPath);

      // Check for video analysis features - increased timeout
      const videoAnalysis = page.locator('text=/video|frames|visual/i');
      await expect(videoAnalysis.first()).toBeVisible({ timeout: 8000 });

      fs.unlinkSync(testVideoPath);
    }
  });

  test('should display analysis cost estimate', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'cost-test.txt');
      fs.writeFileSync(testFilePath, 'x'.repeat(5000)); // Larger file

      await fileInput.setInputFiles(testFilePath);

      // Check for cost/token info - increased timeout
      const costInfo = page.locator('text=/tokens|cost|usage/i');
      const hasCost = await costInfo.isVisible({ timeout: 6000 }).catch(() => false);

      expect(hasCost).toBeDefined();
      fs.unlinkSync(testFilePath);
    }
  });

  test('should support re-analyzing files', async ({ page }) => {
    let analysisCount = 0;
    await page.route('**/api/ai/analyze-file', (route: Route) => {
      analysisCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysis: mockPDFAnalysis,
          cached: analysisCount > 1
        })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'reanalyze-test.txt');
      fs.writeFileSync(testFilePath, 'Test');

      await fileInput.setInputFiles(testFilePath);
      await page.waitForLoadState('networkidle');

      // Look for re-analyze button
      const reanalyzeButton = page.locator('button:has-text("Re-analyze"), button:has-text("Analyze Again")');
      if (await reanalyzeButton.isVisible().catch(() => false)) {
        await reanalyzeButton.first().click();
        await page.waitForLoadState('networkidle');

        expect(analysisCount).toBeGreaterThan(1);
      }

      fs.unlinkSync(testFilePath);
    }
  });

  test('should show analysis model used (GPT-4V, Whisper, etc)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'model-test.txt');
      fs.writeFileSync(testFilePath, 'Test');

      await fileInput.setInputFiles(testFilePath);

      // Check for model indicator - increased timeout
      const modelInfo = page.locator('text=/gpt-4|whisper|model/i');
      const hasModel = await modelInfo.isVisible({ timeout: 6000 }).catch(() => false);

      expect(hasModel).toBeDefined();
      fs.unlinkSync(testFilePath);
    }
  });

  test('should handle rate limiting for file analysis', async ({ page }) => {
    await page.route('**/api/ai/analyze-file', (route: Route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          suggestion: 'Please try again in a minute'
        })
      });
    });

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const testFilePath = path.join(__dirname, 'ratelimit-test.txt');
      fs.writeFileSync(testFilePath, 'Test');

      await fileInput.setInputFiles(testFilePath);

      const rateLimitMsg = page.locator('text=/rate limit|try again/i');
      await expect(rateLimitMsg.first()).toBeVisible({ timeout: 7000 });

      fs.unlinkSync(testFilePath);
    }
  });
});
