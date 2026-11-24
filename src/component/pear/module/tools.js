layui.define(['jquery', 'element'],
    function (exports) {

        var tools = new function () {

            /**
             * @since 防抖算法 
             * 
             * @param fn 要执行的方法
             * @param time 防抖时间参数
             */
            this.debounce = function (fn, time) {
                var timer = null
                return function () {
                    var args = arguments
                    var context = this
                    if (timer) {
                        clearTimeout(timer)
                    }
                    timer = setTimeout(function () {
                        timer = null
                        fn.apply(context, args)
                    }, time)
                }
            }

        };

        exports('tools', tools);
    })