const Agent = require('./agent')
const setupSocket = require('./socket')
const clamp = (n, b, t) => Math.min(t, Math.max(b, n))
const readline = require('readline')

/*const server_params = `
(server_param (catch_ban_cycle 5)(clang_advice_win 1)
(clang_define_win 1)(clang_del_win 1)(clang_info_win 1)
(clang_mess_delay 50)(clang_mess_per_cycle 1)
(clang_meta_win 1)(clang_rule_win 1)(clang_win_size 300)
(coach_port 6001)(connect_wait 300)(drop_ball_time 0)
(freeform_send_period 20)(freeform_wait_period 600)
(game_log_compression 0)(game_log_version 3)
(game_over_wait 100)(goalie_max_moves 2)(half_time -10)
(hear_decay 1)(hear_inc 1)(hear_max 1)(keepaway_start -1)
(kick_off_wait 100)(max_goal_kicks 3)(olcoach_port 6002)
(point_to_ban 5)(point_to_duration 20)(port 6000)
(recv_step 10)(say_coach_cnt_max 128)
(say_coach_msg_size 128)(say_msg_size 10)
(send_step 150)(send_vi_step 100)(sense_body_step 100)
(simulator_step 100)(slow_down_factor 1)(start_goal_l 0)
(start_goal_r 0)(synch_micro_sleep 1)(synch_offset 60)
(tackle_cycles 10)(text_log_compression 0)
(game_log_dir "/home/thoward/data")
(game_log_fixed_name "rcssserver")(keepaway_log_dir "./")
(keepaway_log_fixed_name "rcssserver")
(landmark_file "~/.rcssserver-landmark.xml")
(log_date_format "%Y%m%d%H%M-")(team_l_start "")
(team_r_start "")(text_log_dir "/home/thoward/data")
(text_log_fixed_name "rcssserver")(coach 0)
(coach_w_referee 1)(old_coach_hear 0)(wind_none 0)
(wind_random 0)(auto_mode 0)(back_passes 1)
(forbid_kick_off_offside 1)(free_kick_faults 1)
(fullstate_l 0)(fullstate_r 0)(game_log_dated 1)
(game_log_fixed 1)(game_logging 1)(keepaway 0)
(keepaway_log_dated 1)(keepaway_log_fixed 0)
(keepaway_logging 1)(log_times 0)(profile 0)
(proper_goal_kicks 0)(record_messages 0)(send_comms 0)
(synch_mode 0)(team_actuator_noise 0)(text_log_dated 1)
(text_log_fixed 1)(text_logging 1)(use_offside 1)
(verbose 0)(audio_cut_dist 50)(ball_accel_max 2.7)
(ball_decay 0.94)(ball_rand 0.05)(ball_size 0.085)
(ball_speed_max 2.7)(ball_weight 0.2)(catch_probability 1)
(catchable_area_l 2)(catchable_area_w 1)(ckick_margin 1)
(control_radius 2)(dash_power_rate 0.006)(effort_dec 0.005)
(effort_dec_thr 0.3)(effort_inc 0.01)(effort_inc_thr 0.6)
(effort_init 0)(effort_min 0.6)(goal_width 14.02)
(inertia_moment 5)(keepaway_length 20)(keepaway_width 20)
(kick_power_rate 0.027)(kick_rand 0)(kick_rand_factor_l 1)
(kick_rand_factor_r 1)(kickable_margin 0.7)(maxmoment 180)
(maxneckang 90)(maxneckmoment 180)(maxpower 100)
(minmoment -180)(minneckang -90)(minneckmoment -180)
(minpower -100)(offside_active_area_size 2.5)
(offside_kick_margin 9.15)(player_accel_max 1)
(player_decay 0.4)(player_rand 0.1)(player_size 0.3)
(player_speed_max 1)(player_weight 60)(prand_factor_l 1)
(prand_factor_r 1)(quantize_step 0.1)(quantize_step_l 0.01)
(recover_dec 0.002)(recover_dec_thr 0.3)(recover_min 0.5)
(slowness_on_top_for_left_team 1)
(slowness_on_top_for_right_team 1)(stamina_inc_max 45)
(stamina_max 4000)(stopped_ball_vel 0.01)
(tackle_back_dist 0.5)(tackle_dist 2.5)(tackle_exponent 6)
(tackle_power_rate 0.027)(tackle_width 1.25)
(visible_angle 90)(visible_distance 3)(wind_ang 0)
(wind_dir 0)(wind_force 0)(wind_rand 0))
`;

let msg = Msg.parseMsg(server_params)
let p = msg.p
for (let i in p) {
    let params = p[i].p
    if (Array.isArray(params)) params = params.join(" ")
    console.log(i, p[i].cmd, params)
}
exit()*/

const yargs = require('yargs');
const { exit } = require('process')
const argv = yargs
    .option('team', { type: 'string' })
    .option('coords', { type: 'string' })
    .option('turn', { type: 'number' })
    .option('log', { type: 'boolean' })
    .option('control', { type: 'boolean' })
    .argv;

let teamName = argv.team
if (!teamName) teamName = "A"

let turn = parseInt(argv.turn)
if (isNaN(turn)) turn = 0

let coords = argv.coords
if (coords && coords.includes(':')) {
    coords = coords.split(':')
    coords = [parseFloat(coords[0]), parseFloat(coords[1])]
    if (isNaN(coords[0])) coords[0] = -15
    if (isNaN(coords[1])) coords[1] = 0
    coords[0] = clamp(coords[0], -54, 0)
    coords[1] = clamp(coords[1], -32, 32)
} else {
    coords = [-15, 0]
}

let agent = new Agent()
agent.teamname = teamName
setupSocket(agent)
agent.connector.executeOnConnect((_) => {
    console.log("move to coords ", coords.join(":"))
    agent.socketSend("move", coords)
})
if (turn) {
    console.log("turn applied: ", turn)
    agent.ticker.executeOnTick((_) => {
        agent.act = { n: 'turn', v: turn }
    })
}
if (argv.log) {
    console.log("position logging enabled")
    agent.ticker.executeOnTick((_) => {
        let coordsToString = (coords) => {
            if (!coords || coords.x === undefined || coords.y === undefined)
                return 'unknown coords'
            return `${coords.x.toFixed(2)}:${coords.y.toFixed(2)}`
        }
        console.log(`Agent position: ${coordsToString(agent.position.coords)}`)
        if (Array.isArray(agent.position.objects))
            for (let obj of agent.position.objects) {
                if (obj.isBall)
                    console.log(`\tBall position: ${coordsToString(obj.coords)}`)
                if (obj.isPlayer)
                    console.log(`\tPlayer ${obj.isAlly ? 'ally' : (obj.isEnemy ? 'enemy' : 'unknown team')}: ${coordsToString(obj.coords)}`)
            }
    })
}

if (argv.control) {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    rl.on('line', (input) => {
        if (input === "w") agent.act = { n: "dash", v: 100 }
        else if (input === "d") agent.act = { n: "turn", v: 20 }
        else if (input === "a") agent.act = { n: "turn", v: -20 }
        else if (input === "s") agent.act = { n: "kick", v: 100 }
        else if (input) agent.act = input
    })
}

agent.connector.connect()