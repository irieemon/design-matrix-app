/**
 * EMERGENCY CARD DIMENSION FIX
 * Injectable CSS solution for immediate testing
 *
 * USAGE:
 * 1. Open browser dev tools
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter to execute
 *
 * FIXES APPLIED:
 * - Cards: 60×40px → 80×60px (improved 4:3 ratio)
 * - Background: Force white during all drag operations
 * - Maximum CSS specificity to override any existing rules
 */

console.log('🔧 Applying Emergency Card Dimension Fixes...');

// Emergency CSS with maximum specificity
const emergencyCSS = `
/* ===== EMERGENCY CARD DIMENSION FIXES ===== */

/* COLLAPSED CARDS: Optimal 4:3 ratio (80×60px) */
html body .matrix-container .idea-card-base.is-collapsed,
.matrix-canvas .idea-card-base.is-collapsed,
.matrix-viewport .idea-card-base.is-collapsed,
div .idea-card-base.is-collapsed {
  /* GUARANTEED DIMENSIONS */
  width: 80px !important;
  min-width: 80px !important;
  max-width: 80px !important;
  height: 60px !important;
  min-height: 60px !important;
  max-height: 60px !important;

  /* ENHANCED VISUAL APPEARANCE */
  border-radius: 8px !important;
  background-color: #ffffff !important;
  background-image: none !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08) !important;

  /* LAYOUT STABILITY */
  box-sizing: border-box !important;
  padding: 8px !important;

  /* PREVENT INTERFERENCE */
  transform: translate3d(0, 0, 0) !important;
}

/* DRAG STATE BACKGROUND PROTECTION */
.idea-card-base:active,
.idea-card-base.is-dragging,
.idea-card-base.is-collapsed.is-dragging,
.idea-card-base.is-collapsed:active {
  /* FORCE WHITE BACKGROUND: Never gray */
  background-color: #ffffff !important;
  background-image: none !important;
  background: #ffffff !important;
}

/* COLLAPSED CARD DRAG DIMENSION PROTECTION */
.idea-card-base.is-collapsed.is-dragging,
.idea-card-base.is-collapsed:active {
  /* MAINTAIN DIMENSIONS DURING DRAG */
  width: 80px !important;
  height: 60px !important;
  min-width: 80px !important;
  max-width: 80px !important;
  min-height: 60px !important;
  max-height: 60px !important;
}

/* HOVER STATE ENHANCEMENT */
.idea-card-base.is-collapsed:hover {
  transform: translate3d(0, -2px, 0) !important;
  box-shadow: 0 4px 8px rgba(0,0,0,0.12) !important;
  background-color: #ffffff !important;
}

/* TEXT READABILITY IN NEW DIMENSIONS */
.idea-card-base.is-collapsed .idea-card-title {
  font-size: 11px !important;
  line-height: 1.2 !important;
  text-align: center !important;
  margin: 0 !important;
  padding: 2px 4px !important;

  /* Better text handling for wider cards */
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;

  /* Multi-line support for wider cards if needed */
  /* white-space: normal !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 3 !important;
  -webkit-box-orient: vertical !important; */
}

/* MATRIX BACKGROUND CONSISTENCY */
.matrix-container,
.matrix-canvas,
.matrix-viewport {
  background-color: #ffffff !important;
}

/* SUCCESS INDICATORS */
.emergency-fix-applied {
  border: 2px solid #10b981 !important;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
}
`;

// Create and inject the emergency CSS
const styleElement = document.createElement('style');
styleElement.id = 'emergency-card-fixes';
styleElement.innerHTML = emergencyCSS;

// Remove any existing emergency fixes first
const existingFix = document.getElementById('emergency-card-fixes');
if (existingFix) {
  existingFix.remove();
}

// Inject the new CSS
document.head.appendChild(styleElement);

// Apply success indicator to all collapsed cards
setTimeout(() => {
  const collapsedCards = document.querySelectorAll('.idea-card-base.is-collapsed');
  collapsedCards.forEach(card => {
    card.classList.add('emergency-fix-applied');
  });

  console.log(`✅ Emergency fixes applied to ${collapsedCards.length} collapsed cards`);
  console.log('📏 New dimensions: 80×60px (4:3 ratio)');
  console.log('🎨 Background: Force white during all states');
  console.log('🔒 Maximum CSS specificity to override existing styles');

  // Remove success indicators after 3 seconds
  setTimeout(() => {
    collapsedCards.forEach(card => {
      card.classList.remove('emergency-fix-applied');
    });
  }, 3000);
}, 100);

// Diagnostic information
console.log('📊 DIAGNOSTIC INFO:');
console.log('Current collapsed cards:', document.querySelectorAll('.idea-card-base.is-collapsed').length);
console.log('Previous dimensions: 60×40px (1.5:1 ratio - narrow/tall)');
console.log('New dimensions: 80×60px (4:3 ratio - professional/square)');
console.log('🔍 Improvement: 33% wider, 50% taller for better proportions');