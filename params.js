class Params {
    constructor(agent) {
        this.agent = agent
        this.player_size = null
        this.ball_decay = null
        this.kickable_margin = null
        this.ball_accel_max = null
        this.ball_size = null
        this.ball_speed_max = null
        this.player_speed_max = null
        this.catchable_area_l = null
    }

    analyze(cmd, p) {
        if (cmd === 'server_param') {
            let expected_params = [
                'player_size', 
                'ball_decay', 
                'kickable_margin',
                'ball_accel_max',
                'ball_size',
                'ball_speed_max',
                'player_speed_max',
                'catchable_area_l'
            ]
            for (let param of p) {
                if (expected_params.includes(param.cmd))
                    this[param.cmd] = param.p[0]
            }
            return true
        }
        return false
    }
}

module.exports = Params