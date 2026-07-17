# Argus / Pebble day-to-day shortcuts.
# source scripts/aliases.sh or add to ~/.bashrc:

# Build / install / logs
alias pb='pebble build'
alias pcb='pebble clean && pebble build'
alias pi='pebble install --emulator emery'
alias pbi='pebble build && pebble install --emulator emery'
alias pl='pebble logs --emulator emery'

alias pic='pebble install --cloudpebble'
alias pbic='pebble build && pebble install --cloudpebble'
alias plc='pebble logs --cloudpebble'

# Emulator helpers
alias pcfg='pebble emu-app-config --emulator emery'
alias pk='pebble kill --force'
alias pw='pebble wipe'
alias ppeek-on='pebble emu-set-timeline-quick-view on'
alias ppeek-off='pebble emu-set-timeline-quick-view off'

# Simulation
alias psimw='bash scripts/simulate-weather.sh'
alias psimt='bash scripts/simulate-time.sh'
alias pcaps='bash scripts/capture-screenshots.sh'
alias pcapc='bash scripts/capture-scenario.sh'

# Clay / store
alias bclay='npm run build:clay'
alias sclay='npm run measure-clay'
alias bstr='npm run build:store'

# Emulator reset (from repo root)
alias prst='bash scripts/reset-emulator.sh'
