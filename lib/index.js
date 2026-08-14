/**
 * dsh-sound-alert — Host half.
 *
 * This plugin is browser-first: all detection and playback happens in the
 * client bundle (lib/client.js). This empty apply exists only so the package
 * can appear as a row in a dsh profile's cordis.patch.yml; the browser half
 * is discovered through package.json's `dsh.client` declaration and the
 * `exports["./client"]` bundle, exactly like @deepseek-ai/dsh-client-ui-goal.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply() {}
