# Argus / Pebble day-to-day shortcuts.
# source scripts/aliases.sh or add to ~/.bashrc:

# Build
alias pb='pebble build'
alias pcb='pebble clean && pebble build'
alias bstr='npm run build:store'    # Dedicated store builds

# Emulator
alias pie='pebble install --emulator emery'
alias pbie='pebble build && pebble install --emulator emery'
alias ple='pebble logs --emulator emery'

# CloudPebble
alias pic='pebble install --cloudpebble'
alias pbic='pebble build && pebble install --cloudpebble'
alias plc='pebble logs --cloudpebble'

# Emulator helpers
alias pcfge='pebble emu-app-config --emulator emery'
alias prste='bash scripts/reset-emulator.sh'
alias pke='pebble kill --force'
alias pwe='pebble wipe'
alias ppeek-on='pebble emu-set-timeline-quick-view on'
alias ppeek-off='pebble emu-set-timeline-quick-view off'

# Simulation
alias psimw='bash scripts/simulate-weather.sh'
alias psimt='bash scripts/simulate-time.sh'
alias pcaps='bash scripts/capture-screenshots.sh'
alias pcapc='bash scripts/capture-scenario.sh'

# Clay
alias bclay='npm run build:clay'
alias sclay='npm run measure-clay'
