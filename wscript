top = '.'
out = 'build'

def options(ctx):
    import subprocess
    subprocess.check_call(['node', 'scripts/generate-release.js'], cwd=ctx.path.abspath())
    ctx.load('pebble_sdk')

def configure(ctx):
    ctx.load('pebble_sdk')

def build(ctx):
    ctx.load('pebble_sdk')

    build_worker = False
    binaries = []

    cached_env = ctx.env
    for platform in ctx.env.TARGET_PLATFORMS:
        ctx.env = ctx.all_envs[platform]
        ctx.set_group(ctx.env.PLATFORM_NAME)
        app_elf = '{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
        ctx.pbl_build(source=ctx.path.ant_glob('src/c/**/*.c'), target=app_elf, bin_type='app')
        binaries.append({'platform': platform, 'app_elf': app_elf})
    ctx.env = cached_env

    # Waf may skip merge_js when PKJS sources change under Windows/WSL; drop stale bundle.
    js_bundle = ctx.path.find_node('build/pebble-js-app.js')
    if js_bundle:
        js_bundle.delete()
    js_map = ctx.path.find_node('build/pebble-js-app.js.map')
    if js_map:
        js_map.delete()

    ctx.set_group('bundle')
    ctx.pbl_bundle(
        binaries=binaries,
        js=ctx.path.ant_glob(['src/pkjs/**/*.js', 'src/pkjs/**/*.json']),
        js_entry_file='src/pkjs/index.js'
    )
