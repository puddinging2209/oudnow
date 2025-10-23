import DiagramParser, { OuterTerminal, Train, TrainList } from './DiagramParser.js';

import { Color } from './Util.js';

let diagram_text;
let station_list = []
let parsed_diagram;
let form = document.forms.myform;

let which_dia;
let showing_dep = false
let reload_loop;
let nowtrains;
let loop_cycle;
let loop = false
let nowsecond;
let show_second = false
let howmany_show = 5
let train_types = []
let fastestfor;
let stoptype_list = []
let half_stoptype_list = []
let showing_sta;
let dep_list;
let dep_table;
let hijacksecond = false
let leftsecond = false
let linecolor = "#3949ab"

const container = document.getElementById("station_container")
const body = document.getElementById("body")
const header = document.getElementById("header")
body.style.paddingTop = header.clientHeight

function timeconverter(seconds, showsecond = show_second, showleft = leftsecond) {

    let hh;
    let mm;
    let ss;

    if (seconds != null) {
        if (!showleft) {
            let h = Math.floor(seconds / 3600);
            if (h > 23) {h -= 24};

            let m = Math.floor((seconds % 3600) / 60);
            let s = seconds % 60;

            // 2桁にゼロ埋め
            hh = h.toString().padStart(2, '0');
            mm = m.toString().padStart(2, '0');
            ss = s.toString().padStart(2, '0');
        } else {
            let left = Math.abs(adjust_time(seconds) - adjust_time(nowsecond))
            let left_h = Math.floor(left / 3600)
            let left_m = Math.floor((left % 3600) / 60)
            let left_s = left % 60

            if (left_m !== 0) {
                left_s = left_s.toString().padStart(2, '0');
            }
            if (left_h !== 0) {
                left_m = left_m.toString().padStart(2, '0');
            }

            if (seconds >= nowsecond) {
                if (showsecond) {
                    if (left_h !== 0) {
                        return left_h + "時間" + left_m + "分" + left_s + "秒後"
                    } else if (left_m !== 0) {
                        return left_m + "分" + left_s + "秒後"
                    } else {
                        return left_s + "秒後"
                    }
                } else {
                    if (left_h !== 0) {
                        return left_h + "時間" + left_m + "分後"
                    } else {
                        return left_m + "分後"
                    }
                }
            } else {
                if (showsecond) {
                    if (left_h !== 0) {
                        return left_h + "時間" + left_m + "分" + left_s + "秒前"
                    } else if (left_m !== 0) {
                        return left_m + "分" + left_s + "秒前"
                    } else {
                        return left_s + "秒前"
                    }
                } else {
                    if (left_h !== 0) {
                        return left_h + "時間" + left_m + "分前"
                    } else {
                        return left_m + "分前"
                    }
                }
            }
        }
    } else {
        if (!showleft) {
            hh = "--"
            mm = "--"
            ss = "--"
        } else {
            return "--"
        }
    }

    if(showsecond) {return hh + ":" + mm + "'" + ss} else {return hh + ":" + mm}
    
}

function time_reverser(time_string) {

    const times = time_string.split(":")

    let second = Number(times[0]) * 3600
    second += Number(times[1]) * 60

    if(times[2]) {
        second += Number(times[2])
    }

    return second
}

function adjust_time (time) {
    if(time < parsed_diagram.railway.startTime) {
        return time + 86400
    } else {
        return time
    }
}

function moving_curve (late) {
    switch (true) {

        case late <= 0:
            return 0;

        case 0 < late && late <= (2 - Math.sqrt(3)) / 4:
            return 8 * (late ** 2)

        case (2 - Math.sqrt(3)) / 4 < late && late <= (2 + Math.sqrt(3)) / 4:
            return (8 - 4 * Math.sqrt(3)) * late - (7 - 4 * Math.sqrt(3)) / 2

        case (2 + Math.sqrt(3)) / 4 < late && late <= 1:
            return -8 * ((late - 1) ** 2) + 1;

        case 1 < late:
            return 1

    }
}

function search_fastest (fromsta_index, tosta_index, second = nowsecond) {
    let direction;
    if(fromsta_index < tosta_index) {
        direction = 0
    } else {
        direction = 1
        fromsta_index = station_list.length - 1 - fromsta_index
        tosta_index = station_list.length - 1 - tosta_index
    }

    let train;
    let fastest_train = null
    let fastest_time;
    for(let i = 0; i < parsed_diagram.railway.diagrams[which_dia].trains[direction].length; i++) {
        train = parsed_diagram.railway.diagrams[which_dia].trains[direction][i]
        if (
            train.timetable.firstStationIndex <= fromsta_index && 
            tosta_index <= train.timetable.terminalStationIndex && 
            train.timetable._data[fromsta_index] && 
            train.timetable._data[tosta_index]
        ) {
            if (
                train.timetable._data[fromsta_index].stopType === 1 && train.timetable._data[tosta_index].stopType === 1
            ) {
                let time;
                if (
                    (train.timetable._data[fromsta_index].departure ?? train.timetable._data[fromsta_index].arrival) < 
                    (train.timetable._data[tosta_index].arrival ?? train.timetable._data[tosta_index].departure)
                ) {
                    time = train.timetable._data[tosta_index].arrival ?? train.timetable._data[tosta_index].departure
                } else {
                    time = (train.timetable._data[tosta_index].arrival ?? train.timetable._data[tosta_index].departure) + 86400
                }

                if (
                    second < train.timetable._data[fromsta_index].departure && 
                    (fastest_train === null || 
                    fastest_time > time)
                ) {
                    fastest_train = i
                    fastest_time = time
                }
            }
        }
    }
    return parsed_diagram.railway.diagrams[which_dia].trains[direction][fastest_train]
}


function create_depart_table (station_id = showing_sta) {

    const diagram = parsed_diagram
    dep_list = [[], []]
    for(let d = 0; d < 2; d++) {
        for(let i = 0; i < diagram.railway.diagrams[which_dia].trains[d].length; i++) {
            const train = diagram.railway.diagrams[which_dia].trains[d][i]
            let time;
            if(train.timetable._data[station_id]) {
                if(train.timetable._data[station_id].stopType === 1) {
                    time = adjust_time(train.timetable._data[station_id].departure ?? train.timetable._data[station_id].arrival)
                    let changed_nowsecond = adjust_time(nowsecond)
                    if(time > changed_nowsecond) {
                        dep_list[d].push(train)
                        dep_list[d].sort((a, b) => adjust_time(a.timetable._data[station_id].departure ?? a.timetable._data[station_id].arrival) - adjust_time(b.timetable._data[station_id].departure ?? b.timetable._data[station_id].arrival))
                        dep_list[d].splice(howmany_show,1)
                    }
                }
            }
        }
        station_id = station_list.length - station_id - 1
    }
    console.log(dep_list)

    const dialog = document.getElementsByClassName("dialogInputArea")

    const fastest_train = search_fastest(station_id, fastestfor)

    const makingtable_box = document.createElement("div")
    makingtable_box.id = "dep_table"

    let changed_station_id = station_list.length - station_id - 1
    for(let i = 1; i >= 0; i--) {
        const box = document.createElement("div")
        switch(i) {
            case 0:
                box.textContent = "↓" + diagram.railway.directionName[i]
            break;

            case 1:
                box.textContent = "↑" + diagram.railway.directionName[i]
            break;
        }

        // <table> 要素と <tbody> 要素を作成
        const tbl = document.createElement("table");
        const tblBody = document.createElement("tbody");

        const table_hed = document.createElement("tr")
        const hed_cell_0 = document.createElement("th")
        const hed_Text_0 = document.createTextNode("種別")
        hed_cell_0.appendChild(hed_Text_0);
        table_hed.appendChild(hed_cell_0);
    
        const hed_cell_1 = document.createElement("th")
        const hed_Text_1 = document.createTextNode("行先")
        hed_cell_1.appendChild(hed_Text_1);
        table_hed.appendChild(hed_cell_1);
        
        const hed_cell_2 = document.createElement("th")
        const hed_Text_2 = document.createTextNode("発車時刻")
        hed_cell_2.appendChild(hed_Text_2);
        table_hed.appendChild(hed_cell_2);
        tblBody.appendChild(table_hed);

        let col = 3

        if (
            (i === 0 && station_id < fastestfor) || 
            (i === 1 && station_id > fastestfor)
        ) {
            const hed_cell_3 = document.createElement("th")
            const hed_Text_3 = document.createTextNode(`${station_list[fastestfor]}へ`)
            hed_cell_3.classList.add("times")
            hed_cell_3.appendChild(hed_Text_3);
            table_hed.appendChild(hed_cell_3);

            col++
        }
        
        tblBody.appendChild(table_hed);


        // すべてのセルを作成
        if (dep_list[i].length > 0) {
            for (let j = 0; j < dep_list[i].length; j++) {

                let fastest = false
                if(dep_list[i][j] === fastest_train) {
                    fastest = true
                }

                // 表の行を作成
                const row = document.createElement("tr");

                // <td> 要素とテキストノードを作成し、テキストノードを
                // <td> の内容として、その <td> を表の行の末尾に追加
                const cell_1 = document.createElement("td");
                let cellText_1;
                cellText_1 = document.createTextNode(diagram.railway.trainTypes[dep_list[i][j].type].name);

                const color = diagram.railway.trainTypes[dep_list[i][j].type].strokeColor
                cell_1.style.backgroundColor = `rgb(${color.r} ${color.g} ${color.b})`
                if (color.r < 128 || color.g < 128 || color.b < 128) {
                    cell_1.style.color = "White"
                }

                cell_1.appendChild(cellText_1);
                row.appendChild(cell_1);

                let operation_types0 = []
                if (dep_list[i][j].operations.length !== 0) {
                    operation_types0 = dep_list[i][j].operations.map((obj) => {
                        return obj.outerType;
                    })
                }
                dep_list[i][j].operations.terminal_index = operation_types0.indexOf("A")
                dep_list[i][j].operations.first_index = operation_types0.indexOf("B")
                switch(i) {
                    case 0:
                        dep_list[i][j].terminal = dep_list[i][j].operations.terminal_index === -1 ? 
                            station_list[Number(dep_list[i][j].timetable.terminalStationIndex)] : 
                            diagram.railway.stations[dep_list[i][j].timetable.terminalStationIndex].outerTerminal[dep_list[i][j].operations[dep_list[i][j].operations.terminal_index].terminalStationIndex].name
                    break;

                    case 1:
                        dep_list[i][j].terminal = dep_list[i][j].operations.terminal_index === -1 ? 
                            station_list[station_list.length - 1 - Number(dep_list[i][j].timetable.terminalStationIndex)] : 
                            diagram.railway.stations[station_list.length - 1 - dep_list[i][j].timetable.terminalStationIndex].outerTerminal[dep_list[i][j].operations[dep_list[i][j].operations.terminal_index].terminalStationIndex].name
                    break;
                }

                const cell_2 = document.createElement("td");
                let cellText_2;
                let terminate_here = false
                if(station_list[station_id] === dep_list[i][j].terminal) {
                    cellText_2 = document.createTextNode("当駅止")
                    terminate_here = true
                } else {
                    cellText_2 = document.createTextNode(dep_list[i][j].terminal);
                }
                cell_2.appendChild(cellText_2);
                row.appendChild(cell_2);

                const cell_3 = document.createElement("td");
                if (!leftsecond) {
                    cell_3.classList.add("times")
                } else {
                    cell_3.classList.add("lefts")
                }
                let cellText_3;
                if (!terminate_here) {
                    cellText_3 = document.createTextNode(timeconverter(dep_list[i][j].timetable._data[changed_station_id].departure ?? dep_list[i][j].timetable._data[changed_station_id].arrival));
                } else {
                    cellText_3 = document.createTextNode("")
                }
                cell_3.appendChild(cellText_3);
                row.appendChild(cell_3);

                if(fastest) {
                    const cell_4 = document.createElement("td")
                    const cellText_4 = document.createTextNode("先着")
                    cell_4.classList.add("times")
                    cell_4.appendChild(cellText_4)
                    row.appendChild(cell_4)
                }

                row.addEventListener("click", (event) => {
                    showdialog(dep_list[i][j])
                })

                // 表の本体の末尾に行を追加
                tblBody.appendChild(row);
            }
        } else {
            // 表の行を作成
            const row = document.createElement("tr");
            const endday = document.createElement("td")
            endday.textContent = "☆☆☆日本は終了しました☆☆☆"
            endday.classList.add("times")
            endday.colSpan = `${col}`
            row.appendChild(endday)
            tblBody.appendChild(row)
        }

        // <tbody> を <table> の中に追加
        tbl.appendChild(tblBody);
        // <table> を <body> の中に追加
        box.appendChild(tbl);
        // tbl の border 属性を 2 に設定
        tbl.setAttribute("border", "1");

        makingtable_box.appendChild(box)
        dialog[0].appendChild(makingtable_box)
        dep_table = document.getElementById("dep_table")

        changed_station_id = station_id
    }
}

function showdialog (pushed_train) {

    clearInterval(reload_loop)

    console.log(pushed_train)

    let pushed_times = []
    let stop_stations = []
    let wherenow;
    for(let i = pushed_train.timetable.firstStationIndex; i < pushed_train.timetable._data.length; i++) {
        if(pushed_train.timetable._data[i]) {
            if(
                (pushed_train.timetable._data[i].arrival || pushed_train.timetable._data[i].departure) && 
                pushed_train.timetable._data[i].stopType === 1
            ) {
                let check_time = pushed_train.timetable._data[i].arrival ?? pushed_train.timetable._data[i].departure
                if(
                    adjust_time(check_time) > adjust_time(nowsecond) && 
                    ((pushed_train.direction === 0 && station_list[i] !== station_list[stop_stations.at(-1)]) || 
                    (pushed_train.direction === 1 && station_list[station_list.length - 1 - i] !== station_list[station_list.length - 1 - stop_stations.at(-1)]))
                ) {
                    if (wherenow == null) {wherenow = pushed_times.length}
                }
                pushed_times.push(check_time)
                stop_stations.push(i)
            }
        }
    }

    const makingdialog = document.createElement("dialog")
    makingdialog.id = "dialog"
    container.appendChild(makingdialog)
    const dialog = document.getElementById("dialog")

    const train_info_div = document.createElement("div")
    if (pushed_train.number) {
        const info_number = document.createElement("div")
        info_number.textContent = pushed_train.number
        info_number.id = "number_info"
        train_info_div.appendChild(info_number)
    }
    const info_type = document.createElement("div")
    info_type.id = "type_info"
    if (pushed_train.name === "") {
        const type = document.createElement("div")
        type.id = "type"
        type.textContent = train_types[Number(pushed_train.type)].name
        const pushed_color = train_types[Number(pushed_train.type)].strokeColor
        type.style.backgroundColor = `rgb(${pushed_color.r} ${pushed_color.g} ${pushed_color.b})`
        if (pushed_color.r < 128 || pushed_color.g < 128 || pushed_color.b < 128) {
            type.style.color = "White"
        }

        const terminal = document.createElement("div")
        terminal.id = "terminal"
        terminal.textContent = pushed_train.terminal + "行"

        info_type.appendChild(type)
        info_type.appendChild(terminal)
    } else if (pushed_train.count === "") {
        info_type.textContent = `${pushed_train.name} ${pushed_train.terminal}行`
    } else {
        info_type.textContent = `${pushed_train.name} ${pushed_train.count}号 ${pushed_train.terminal}行`
    }
    train_info_div.appendChild(info_type)
    dialog.appendChild(train_info_div)

    // <table> 要素と <tbody> 要素を作成
    const tbl = document.createElement("table");
    const tblBody = document.createElement("tbody");

    const table_hed = document.createElement("tr")
    const hed_cell_0 = document.createElement("th")
    const hed_Text_0 = document.createTextNode("停車駅")
    hed_cell_0.classList.add("times")
    hed_cell_0.appendChild(hed_Text_0);
    table_hed.appendChild(hed_cell_0);
   
    const hed_cell_1 = document.createElement("th")
    const hed_Text_1 = document.createTextNode("到着時刻")
    hed_cell_1.classList.add("times")
    hed_cell_1.appendChild(hed_Text_1);
    table_hed.appendChild(hed_cell_1);
    tblBody.appendChild(table_hed);

    let col = 3

    let outer_first = false
    if (pushed_train.operations.first_index !== -1) {

        outer_first = true

        // 表の行を作成
        const row = document.createElement("tr");

        // <td> 要素とテキストノードを作成し、テキストノードを
        // <td> の内容として、その <td> を表の行の末尾に追加
        const cell_1 = document.createElement("td");
        let cellText_1;
        if (pushed_train.direction === 0) {
            cellText_1 = document.createTextNode(parsed_diagram.railway.stations[pushed_train.operations[pushed_train.operations.first_index].stationIndex].outerTerminal[pushed_train.operations[pushed_train.operations.first_index].terminalStationIndex].name + "(発)");
        } else {
            cellText_1 = document.createTextNode(parsed_diagram.railway.stations[station_list.length - 1 - pushed_train.operations[pushed_train.operations.first_index].stationIndex].outerTerminal[pushed_train.operations[pushed_train.operations.first_index].terminalStationIndex].name + "(発)");
        }
        cell_1.appendChild(cellText_1);

        const cell_2 = document.createElement("td");
        const cellText_2 =  document.createTextNode(timeconverter(pushed_train.operations[pushed_train.operations.first_index].time));
        if (!leftsecond) {
            cell_2.classList.add("times")
        } else {
            cell_2.classList.add("lefts")
        }
        cell_2.appendChild(cellText_2);

        if (
            adjust_time(nowsecond) > adjust_time(pushed_train.operations[pushed_train.operations.first_index].time) || 
            (pushed_train.operations[pushed_train.operations.first_index].time == null && wherenow !== 0)
        ) {
            cell_1.classList.add("gray")
            cell_2.classList.add("gray")
        }
        row.appendChild(cell_1);
        row.appendChild(cell_2);

        // 表の本体の末尾に行を追加
        tblBody.appendChild(row);

        // 表の行を作成
        const row0 = document.createElement("tr");

        // <td> 要素とテキストノードを作成し、テキストノードを
        // <td> の内容として、その <td> を表の行の末尾に追加
        const cell_10 = document.createElement("td");
        const cell_11 = document.createElement("td")
        let cellText_10;
        cellText_10 = document.createTextNode("：");
        cell_10.appendChild(cellText_10);
        if (
            adjust_time(nowsecond) > adjust_time(pushed_train.operations[pushed_train.operations.first_index].time) || 
            (pushed_train.operations[pushed_train.operations.first_index].time == null && wherenow !== 0)
        ) {
            cell_10.classList.add("gray")
            cell_11.classList.add("gray")
        }
        row0.appendChild(cell_10);
        row0.appendChild(cell_11)

        // 表の本体の末尾に行を追加
        tblBody.appendChild(row0);

    }

    // すべてのセルを作成
    for (let i = 0; i < pushed_times.length; i++) {

        if (wherenow === i && wherenow !== 0) {
            // 表の行を作成
            const row = document.createElement("tr");
            const already_depart = document.createElement("td")
            already_depart.textContent = "-----<発車済み>-----"
            already_depart.classList.add("times")
            already_depart.colSpan = `${col}`
            row.appendChild(already_depart)
            tblBody.appendChild(row)
        }

        // 表の行を作成
        const row = document.createElement("tr");

        // <td> 要素とテキストノードを作成し、テキストノードを
        // <td> の内容として、その <td> を表の行の末尾に追加
        const cell_1 = document.createElement("td");
        let cellText_1;
        let text_1
        if(pushed_train.direction === 0) {
            text_1 = station_list[stop_stations[i]]
        } else {
            text_1 = station_list[station_list.length - stop_stations[i] - 1]
        }
        if (!outer_first && i === 0) {
            text_1 += "(発)"
        }
        cellText_1 = document.createTextNode(text_1)
        cell_1.appendChild(cellText_1);

        const cell_2 = document.createElement("td");
        if (!leftsecond) {
            cell_2.classList.add("times")
        } else {
            cell_2.classList.add("lefts")
        }
        const cellText_2 = document.createTextNode(timeconverter(pushed_times[i]));
        cell_2.appendChild(cellText_2);

        if (i < wherenow) {
            cell_1.classList.add("gray")
            cell_2.classList.add("gray")
        }
        row.appendChild(cell_1);
        row.appendChild(cell_2);

        // 表の本体の末尾に行を追加
        tblBody.appendChild(row);
    }

    if(pushed_train.operations.terminal_index !== -1) {
        // 表の行を作成
        const row0 = document.createElement("tr");

        // <td> 要素とテキストノードを作成し、テキストノードを
        // <td> の内容として、その <td> を表の行の末尾に追加
        const cell_10 = document.createElement("td");
        let cellText_10;
        cellText_10 = document.createTextNode("：");
        cell_10.appendChild(cellText_10);
        row0.appendChild(cell_10);

        // 表の本体の末尾に行を追加
        tblBody.appendChild(row0);



        // 表の行を作成
        const row = document.createElement("tr");

        // <td> 要素とテキストノードを作成し、テキストノードを
        // <td> の内容として、その <td> を表の行の末尾に追加
        const cell_1 = document.createElement("td");
        let cellText_1;
        cellText_1 = document.createTextNode(pushed_train.terminal);
        cell_1.appendChild(cellText_1);
        row.appendChild(cell_1);

        const cell_2 = document.createElement("td");
        const cellText_2 =  document.createTextNode(timeconverter(pushed_train.operations[pushed_train.operations.terminal_index].time));
        cell_2.classList.add("times")
        cell_2.appendChild(cellText_2);
        row.appendChild(cell_2);

        // 表の本体の末尾に行を追加
        tblBody.appendChild(row);

    }

    // <tbody> を <table> の中に追加
    tbl.appendChild(tblBody);
    // <table> を <body> の中に追加
    dialog.appendChild(tbl);
    // tbl の border 属性を 2 に設定
    tbl.setAttribute("border", "1");

    if(pushed_train.note) {
        const note = document.createElement("div")
        note.textContent = pushed_train.note
        dialog.appendChild(note)
    }

    dialog.showModal()
    document.documentElement.style.overflow = "hidden"

    dialog.addEventListener('click', (event) => {
        if(event.target.closest('#dialog_inputarea') === null) {
            dialog.close();
            dialog.remove()
            document.documentElement.style.overflow = "visible"
            if(loop) {
                set_train_position(parsed_diagram)
                reload_loop = setInterval(() => {
                    set_train_position(parsed_diagram)
                    if (showing_dep) {
                        dep_table.remove()
                        create_depart_table()
                    }
                }, loop_cycle * 1000)
            }
        }
    })
}

function show_departure (station_id) {

    showing_sta = station_id
    showing_dep = true

    const makingdialog = document.createElement("dialog")
    makingdialog.id = "dialog"

    const makingdialog_inputarea =document.createElement("div")
    makingdialog_inputarea.id = "dialogInputArea"
    makingdialog_inputarea.className = "dialogInputArea"
    makingdialog.appendChild(makingdialog_inputarea)
    document.getElementById("body").appendChild(makingdialog)

    const dialog = document.getElementById("dialogInputArea")
    const real_dialog = document.getElementById("dialog")

    const name = document.createElement("div")
    name.id = "sta_name"
    name.textContent = station_list[station_id] + "駅"
    dialog.appendChild(name)

    const pull_down_div = document.createElement("div")
    pull_down_div.id = "fastestfor_div"
    const pull_down = document.createElement("select")
    pull_down.id = "fastestfor"
    for(let i = 0; i < station_list.length; i++) {
        if(i !== station_id) {
            const oneof_pulldown = document.createElement("option")
            oneof_pulldown.value = i
            oneof_pulldown.textContent = station_list[i]
            if((station_id <= station_list.length / 2 && i === station_list.length - 1) || (station_id > station_list.length / 2 && i === 0)) {
                oneof_pulldown.setAttribute("selected", "")
                fastestfor = i
            }
            pull_down.appendChild(oneof_pulldown)
        }
    }
    pull_down_div.appendChild(pull_down)

    const pull_down_label = document.createElement("div")
    pull_down_label.textContent = "に先着する列車を表示"
    pull_down_div.appendChild(pull_down_label)

    dialog.appendChild(pull_down_div)

    create_depart_table()

    pull_down.addEventListener('change', (event) => {
        let pull_downed = document.getElementById("fastestfor")
        fastestfor = pull_downed.value
        dep_table.remove()
        create_depart_table()
    })

    real_dialog.showModal()
    document.documentElement.style.overflow = "hidden"

    real_dialog.addEventListener('click', (event) => {
        if(event.target.closest('#dialogInputArea') === null) {
            real_dialog.close();
            real_dialog.remove()
            document.documentElement.style.overflow = "visible"
            showing_dep = false
        }
    })

}

function set_train_position (diagram) {

    document.getElementById("reload_box").style.visibility = "visible";

    parent = document.getElementById("station_container")
    const spans = Array.from(parent.getElementsByTagName("span"))
    for(let i = 0; i < spans.length; i++){
        spans[i].remove();
    }

    if (!hijacksecond) {
        let DD = new Date()
        let h = String(DD.getHours());
        let m = String(DD.getMinutes());
        while (m.length < 2) {m = "0" + m}
        let s = String(DD.getSeconds());
        while (s.length < 2) {s = "0" + s}
        nowsecond = Number(h) * 3600 + Number(m) * 60 + Number(s)
    } else if (loop) {
        nowsecond += loop_cycle
    }

    console.log(timeconverter(nowsecond, true))
    document.getElementById("nowtime").textContent = timeconverter(nowsecond,show_second,false)

    nowtrains = []
    for(let d = 0; d < 2; d++) {

        let nowtrain = []
        for(let i = 0; i < diagram.railway.diagrams[which_dia].trains[d].length; i++) {

            let checking_train_timetable = diagram.railway.diagrams[which_dia].trains[d][i].timetable
            let first_sta = checking_train_timetable._data[checking_train_timetable.firstStationIndex]
            let final_sta = checking_train_timetable._data[checking_train_timetable.terminalStationIndex]

            let first_dep = first_sta?.departure ?? first_sta?.arrival
            let final_arr = final_sta?.arrival ?? final_sta?.departure

            if (first_dep !== null && final_arr !== null) {
                if(
                    checking_train_timetable.firstStationIndex >= 0 && 
                    (adjust_time(first_dep) <= adjust_time(nowsecond) && 
                    adjust_time(final_arr) >= adjust_time(nowsecond))
                ) {
                    nowtrain.push(diagram.railway.diagrams[which_dia].trains[d][i])
                }
            }
        }

        for(let i = 0; i < nowtrain.length; i++) {

            const timetable = nowtrain[i].timetable;
            let time_list = []
            let via_stations = []
            let arrivals = []
            let departures = []

            for(let j = timetable.firstStationIndex; j <= timetable.terminalStationIndex; j++) {
                if(timetable._data[j]) {
                    via_stations.push(j)
                    if (timetable._data[j].arrival !== null) {
                        time_list.push(timetable._data[j].arrival)
                    }
                    if (timetable._data[j].departure !== null) {
                        time_list.push(timetable._data[j].departure)
                    }
                    arrivals.push(timetable._data[j].arrival)
                    departures.push(timetable._data[j].departure)
                }
            }

            for(let j = 0; j < via_stations.length - 1; j++) {
                if (via_stations[j] + 1 !== via_stations[j + 1]) {

                    // 到着・出発が null のとき、前の値で補完する（完全な補完が必要なら線形補間の方が良）
                    if (arrivals[j + 1] == null) {
                        arrivals[j + 1] = arrivals[j];
                        time_list.splice(time_list.indexOf(arrivals[j]), 0, arrivals[j]); // 補間した到着を time_list に追加
                    }

                    // j の駅情報を削除（ここで j+1 は維持）
                    const removedArrival = arrivals.splice(j, 1)[0];
                    const removedDeparture = departures.splice(j, 1)[0];
                    via_stations.splice(j, 1);

                    // time_list から削除（存在チェック付きで安全に）
                    const aIndex = time_list.indexOf(removedArrival);
                    if (aIndex !== -1) time_list.splice(aIndex, 1);

                    const dIndex = time_list.indexOf(removedDeparture);
                    if (dIndex !== -1) time_list.splice(dIndex, 1);
    
                }
            }

            time_list.sort((a, b) => a - b)

            let currentIndex;
            let pass_count = 0
            let stopping;
            for(let j = 0; j < time_list.length; j++) {
                if (timetable._data[via_stations[arrivals.indexOf(time_list[j])]]) {
                    if (adjust_time(time_list[j]) <= adjust_time(nowsecond) &&
                        adjust_time(nowsecond) <= adjust_time(time_list[j + 1]) &&
                        arrivals.includes(time_list[j]) && 
                        !departures.includes(time_list[j]) && 
                        timetable._data[via_stations[arrivals.indexOf(time_list[j])]].stopType === 1
                    ) {
                        currentIndex = arrivals.indexOf(time_list[j])
                        stopping = true
                        break;
                    }
                }

                if (adjust_time(time_list[j]) <= adjust_time(nowsecond) &&
                    adjust_time(nowsecond) <= adjust_time(time_list[j + 1]) &&
                    departures.includes(time_list[j])
                ) {
                    currentIndex = departures.indexOf(time_list[j])
                    if (arrivals.indexOf(time_list[j + 1]) !== -1) {
                        pass_count = arrivals.indexOf(time_list[j + 1]) - currentIndex
                    } else {
                        pass_count = departures.indexOf(time_list[j + 1]) - currentIndex
                    }

                    stopping = false
                    break;
                }
            }

            let topPx = 0;
            let first_depart = true
            let waitcount = 0
            if (currentIndex !== -1) {
                switch (stopping) {
                    case false:

                        var depTime = timetable._data[via_stations[currentIndex]].departure;
                        var arrTime = timetable._data[via_stations[currentIndex + pass_count]].arrival ?? timetable._data[via_stations[currentIndex + pass_count]].departure

                        var elapsed = nowsecond - depTime;
                        var total = arrTime - depTime;

                        var ratio = moving_curve(elapsed / total)

                        currentIndex = via_stations[currentIndex + Math.floor(ratio * pass_count)]
                        ratio = (ratio - Math.floor(ratio * pass_count) / pass_count) * pass_count

                        var baseTop = 150 * currentIndex;

                        topPx = (currentIndex + ratio) * 150
                    break;

                    case true:
                        var baseTop = 150 * via_stations[currentIndex];

                        topPx = baseTop

                        // 先発かどうか調べる
                        for(let j = 0; j < diagram.railway.diagrams[which_dia].trains[d].length; j++) {
                            const train = diagram.railway.diagrams[which_dia].trains[d][j]
                            let time;
                            if(train.timetable._data[via_stations[currentIndex]]) {
                                if(train.timetable._data[via_stations[currentIndex]].departure || train.timetable._data[via_stations[currentIndex]].arrival) {
                                    time = adjust_time(train.timetable._data[via_stations[currentIndex]].departure ?? train.timetable._data[via_stations[currentIndex]].arrival)
                                    if(
                                        time >= adjust_time(nowtrain[i].timetable._data[via_stations[currentIndex]].arrival) && 
                                        adjust_time(nowtrain[i].timetable._data[via_stations[currentIndex]].departure) > time && 
                                        train.timetable.terminalStationIndex !== via_stations[currentIndex]
                                    ) {
                                        first_depart = false
                                        waitcount++
                                    }
                                } else if(train.timetable._data[via_stations[currentIndex]].stopType === 2) {
                                    let start_passing = train.timetable.firstStationIndex
                                    let end_passing = train.timetable.terminalStationIndex
                                    for (let k = via_stations[currentIndex]; k >= train.timetable.firstStationIndex; k--) {
                                        if (train.timetable._data[k].stopType === 1) {
                                            start_passing = k
                                            break;
                                        }
                                    }
                                    for (let k = via_stations[currentIndex]; k <= train.timetable.terminalStationIndex; k++) {
                                        if (train.timetable._data[k].stopType === 1) {
                                            end_passing = k
                                            break;
                                        }
                                    }
                                    let pass_length = end_passing - start_passing
                                    let current_late = (via_stations[currentIndex] - start_passing) / pass_length
                                    let moving_time = (train.timetable._data[end_passing].arrival ?? train.timetable._data[end_passing].departure) - (train.timetable._data[start_passing].departure ?? train.timetable._data[start_passing].arrival)

                                    time = (train.timetable._data[start_passing].departure ?? train.timetable._data[start_passing].arrival) + moving_time * current_late
                                    if (time >= adjust_time(nowtrain[i].timetable._data[via_stations[currentIndex]].arrival) && adjust_time(nowtrain[i].timetable._data[via_stations[currentIndex]].departure) > time) {
                                        first_depart = false
                                        waitcount++
                                    }
                                }
                            }
                        }

                    break;
                }
            }

            let type_color
            switch(d) {
                case 0:
                    const train_down_wrapper = document.createElement("span");
                    train_down_wrapper.className = "train_wrapper_down"
                    train_down_wrapper.id = `${d}${i}`
                    train_down_wrapper.style.top = `${topPx}px`
                    if(first_depart) {
                        train_down_wrapper.style.left = "calc(65vw - 50px)"
                    } else {
                        train_down_wrapper.style.left = `calc(${65 + waitcount * 7}vw - 50px)`
                    }

                    container.appendChild(train_down_wrapper)
                    
                    const wrapper_down = document.getElementById(`${d}${i}`)
                    
                    const train_down = document.createElement("div")
                    train_down.className = "train_down"
                    type_color = train_types[Number(nowtrain[i].type)].strokeColor
                    train_down.style.backgroundColor = `rgb(${type_color.r} ${type_color.g} ${type_color.b})`
                    wrapper_down.appendChild(train_down)

                    let operation_types0 = []
                    if (nowtrain[i].operations.length !== 0) {
                        operation_types0 = nowtrain[i].operations.map((obj) => {
                            return obj.outerType;
                        })
                    }
                    nowtrain[i].operations.terminal_index = operation_types0.indexOf("A")
                    nowtrain[i].operations.first_index = operation_types0.indexOf("B")
                    nowtrain[i].terminal = nowtrain[i].operations.terminal_index === -1 ? 
                        station_list[Number(nowtrain[i].timetable.terminalStationIndex)] : 
                        diagram.railway.stations[nowtrain[i].timetable.terminalStationIndex].outerTerminal[nowtrain[i].operations[nowtrain[i].operations.terminal_index].terminalStationIndex].name
                    
                    const train_down_text = document.createElement("div")
                    train_down_text.className = "rightlabel"
                    train_down_text.innerHTML = `${train_types[Number(nowtrain[i].type)].name} ${nowtrain[i].name}<br>${nowtrain[i].terminal}`
                    wrapper_down.appendChild(train_down_text)
                break;

                case 1:
                    topPx = 150 * (station_list.length - 1) - topPx

                    const train_up_wrapper = document.createElement("span");
                    train_up_wrapper.className = "train_wrapper_up"
                    train_up_wrapper.id = `${d}${i}`
                    train_up_wrapper.style.top = `${topPx}px`

                    container.appendChild(train_up_wrapper)
                    
                    const wrapper_up = document.getElementById(`${d}${i}`)
                    
                    let operation_types1 = []
                    if (!nowtrain[i].operations.length !== 0) {
                        operation_types1 = nowtrain[i].operations.map((obj) => {
                            return obj.outerType;
                        })
                    }
                    nowtrain[i].operations.terminal_index = operation_types1.indexOf("A")
                    nowtrain[i].operations.first_index = operation_types1.indexOf("B")
                    nowtrain[i].terminal = nowtrain[i].operations.terminal_index === -1 ? 
                        station_list[station_list.length - 1 - Number(nowtrain[i].timetable.terminalStationIndex)] : 
                        diagram.railway.stations[station_list.length - 1 - nowtrain[i].timetable.terminalStationIndex].outerTerminal[nowtrain[i].operations[nowtrain[i].operations.terminal_index].terminalStationIndex].name
                    
                    const train_up_text = document.createElement("div")
                    train_up_text.className = "leftlabel"
                    train_up_text.id = `text${d}${i}`
                    train_up_text.innerHTML = `${train_types[Number(nowtrain[i].type)].name} ${nowtrain[i].name}<br>${nowtrain[i].terminal}`
                    wrapper_up.appendChild(train_up_text)

                    const text_width = document.getElementById(`text${d}${i}`).getBoundingClientRect().width
                    if(first_depart) {
                        train_up_wrapper.style.left = `calc(35vw - ${text_width}px)`
                    } else {
                        train_up_wrapper.style.left = `calc(${35 - waitcount * 7}vw - ${text_width}px)`
                    }

                    const train_up = document.createElement("div")
                    train_up.className = "train_up"
                    type_color = train_types[Number(nowtrain[i].type)].strokeColor
                    train_up.style.backgroundColor = `rgb(${type_color.r} ${type_color.g} ${type_color.b})`
                    wrapper_up.appendChild(train_up)
                break;
            }

            document.getElementById(`${d}${i}`).addEventListener("click", function(e) {
                showdialog(nowtrains[d][i])
            })
        }
        nowtrains[d] = nowtrain
    }
    console.log(nowtrains)

    body.style.paddingTop = `${header.clientHeight}px`

}

function set_stations (diagram) {

    let parent = document.getElementById("diagram_selecter");
    while(parent.firstChild){
        parent.removeChild(parent.firstChild);
    }
    
    parent = document.getElementById("station_container")
    const divs = Array.from(parent.getElementsByTagName("div"))
    for(let i = 0; i < divs.length; i++){
        divs[i].remove();
    }

    // 駅一覧リスト作成
    station_list = []
    stoptype_list = []
    half_stoptype_list = []
    let type_exist = []
    for (let i = 0; i < diagram.railway.stations.length; i++) {
        station_list.push(diagram.railway.stations[i].name)
        stoptype_list[i] = []
        half_stoptype_list[i] = []
        type_exist[i] = []
        for(let j = 0; j < diagram.railway.trainTypes.length; j++) {
            stoptype_list[i][j] = true
            half_stoptype_list[i][j] = false
            type_exist[i][j] = false
        }
    }

    for(let d = 0; d < 2; d++) {
        for(let i = 0; i < diagram.railway.diagrams[which_dia].trains[d].length; i++) {
            const thistrain = diagram.railway.diagrams[which_dia].trains[d][i]
            if(thistrain.timetable.firstStationIndex >= 0) {
                for(let j = thistrain.timetable.firstStationIndex; j <= thistrain.timetable.terminalStationIndex; j++) {
                    let re_j;
                    if(d === 0) {
                        re_j = j
                    } else {
                        re_j = station_list.length - 1 - j
                    }
                    if(thistrain.timetable._data[j]) {
                        type_exist[re_j][thistrain.type] = true
                        if(thistrain.timetable._data[j].stopType !== 1) {
                            stoptype_list[re_j][thistrain.type] = false
                        } else {
                            half_stoptype_list[re_j][thistrain.type] = true
                        }
                    }
                }
            }
        }
    }

    for (let i = 0; i < stoptype_list.length; i++) {
        for (let j = 0; j < diagram.railway.trainTypes.length; j++) {
            if(!type_exist[i][j]) {
                stoptype_list[i][j] = false
                half_stoptype_list[i][j] = false
            }
        }
    }

    for (let i = 0; i < station_list.length; i++) {
        const box = document.createElement("div");
        box.className = "box";
        box.id = `sta-${i}`
        box.textContent = `${station_list[i]}`;
        box.style.width = window.innerWidth - 200
        if(diagram.railway.stations[i].isMain) {
            box.style.fontWeight = "bold"
        } else {
            box.style.fontWeight = "normal"
        }
        container.appendChild(box);

        const type_info = document.createElement("div")
        type_info.className = "type_info"
        for(let j = 0; j < stoptype_list[i].length; j++) {
            if(stoptype_list[i][j]) {
                type_info.textContent = type_info.textContent + diagram.railway.trainTypes[j].name + " "
            } else if(half_stoptype_list[i][j]) {
                type_info.textContent = type_info.textContent + "(" + diagram.railway.trainTypes[j].name + ") "
            }
        }
        type_info.style.top = `${150 * (i) + 50}px`
        container.appendChild(type_info)

        const station = document.getElementById(`sta-${i}`)
        station.addEventListener("click", function (event) {
            show_departure(i)
        })
    }

    for(let i = 0; i < diagram.railway.diagrams.length; i++) {

        const diaselecter_input = document.createElement("input")
        diaselecter_input.type = "radio"
        diaselecter_input.name = "selecter"
        diaselecter_input.value = i
        diaselecter_input.id = `selecter-${i}`
        if (i === which_dia) {
            diaselecter_input.checked = "checked"
        }

        const diaselecter_label = document.createElement("label")
        diaselecter_label.setAttribute("for", `selecter-${i}`)

        const dia_selecter_div = document.getElementById("diagram_selecter")

        dia_selecter_div.appendChild(diaselecter_input)
        diaselecter_label.textContent = diagram.railway.diagrams[i].name
        dia_selecter_div.appendChild(diaselecter_label)
    }
}

function generateline () {
    const oldline = document.getElementById("line")
    oldline.remove()

    const line = document.createElement("div")
    line.className = "line"
    line.id = "line"
    line.style.height = `${150 * (station_list.length - 1) + 50}px`
    line.style.left = `${window.innerWidth / 2 - 10}px`
    line.style.background = linecolor
    container.appendChild(line)
}

form.myfile.addEventListener( "change", function(e) {

    let result = e.target.files[0];

    //FileReaderのインスタンスを作成する
    let reader = new FileReader();

    const filename = result.name
    const DotIndex = filename.lastIndexOf('.')
    const extension = lastDotIndex === -1 ? '' : filename.slice(DotIndex + 1)
  
    //読み込んだファイルの中身を取得する
    if (extension == "oud") {
        reader.readAsText( result , "Shift_JIS");
    } else if (extension == "oud2") {
        reader.readAsText( result , "utf-8");
    }
  
    //ファイルの中身を取得後に処理を行う
    reader.addEventListener( 'load', function() {
    
        diagram_text = reader.result

        const parser = new DiagramParser();
        parser
        .parse(diagram_text)
        .then(diagram => {
            
            which_dia = 0
            parsed_diagram = diagram
            train_types = diagram.railway.trainTypes
            showing_dep = false
            console.log(diagram)
            console.log(JSON.stringify(diagram))
            set_stations(diagram)
            generateline()
            set_train_position(diagram)

        })
        .catch(err => console.error('パースできなかったよ(ToT).', err));

    })

})

document.getElementById("diagram_selecter").addEventListener('change', function (event) {
    if (event.target.name === "selecter") {
        const selectedIndex = parseInt(event.target.value);
        which_dia = selectedIndex
        set_train_position(parsed_diagram)
    }
});

document.getElementById("reload_button").addEventListener("click", function (event) {
    console.log(parsed_diagram)
    set_train_position(parsed_diagram)
})

const reload_switch = document.getElementById("auto_reload")
reload_switch.addEventListener("change", function (event) {
    loop_cycle = Number(document.getElementById("reload_cycle").value)
    if(loop_cycle) {
        if(reload_switch.checked) {
            reload_loop = setInterval(() => {
                set_train_position(parsed_diagram)
                if (showing_dep) {
                    dep_table.remove()
                    create_depart_table()
                }
            }, loop_cycle * 1000);
            loop = true
        } else {
            clearInterval(reload_loop)
            loop = false
        }
    } else {
        reload_switch.checked = false
        alert("値を入力してください")
    }
})

const option_button = document.getElementById("option_button")
const option_dialog = document.getElementById("options")

option_button.addEventListener("click", function (event) {

    clearInterval(reload_loop)

    option_dialog.showModal()

    document.documentElement.style.overflow = "hidden"

})

// optionsを閉じたとき
option_dialog.addEventListener('click', (event) => {
    if(event.target.closest('#option_dialogInputArea') === null) {
        option_dialog.close()
        document.documentElement.style.overflow = "visible"

        show_second = document.getElementById("showsecond").checked
        howmany_show = document.getElementById("howmany_show").value
        hijacksecond = document.getElementById("hijacksecond").checked
        leftsecond = document.getElementById("leftsecond").checked
        const input_time = document.getElementById("hijacked_time")
        linecolor = document.getElementById("linecolor").value
        generateline()

        if (hijacksecond) {
            if (input_time.value) {
                nowsecond = time_reverser(input_time.value)
                console.log(input_time.value, time_reverser(input_time.value))
            } else {
                document.getElementById("hijacksecond").checked = false
                alert("値を入力してください")
            }
        }
        if(loop) {
            set_train_position(parsed_diagram)
            reload_loop = setInterval(() => {
                set_train_position(parsed_diagram)
                if (showing_dep) {
                    dep_table.remove()
                    create_depart_table()
                }
            }, loop_cycle * 1000)
        }
    }
})