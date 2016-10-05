import localForage from 'localforage';

export class List {
    constructor(key) {
        this._key = key;
    }

    push(item) {
        return localForage.getItem(this._key).then(list => {
            if (list === null) {
                list = [];
            }
            list.push(item);
            return localForage.setItem(this._key, list);
        });
    }

    extend(extend_list) {
        return localForage.getItem(this._key).then(list => {
            if (list === null) {
                list = [];
            }
            return localForage.setItem(this._key, list.concat(extend_list));
        });
    }

    insert(item, position) {
        return localForage.getItem(this._key).then(list => {
            if (list === null) {
                list = [];
            }
            list.splice(position, 0, item);
            return localForage.setItem(this._key, list);
        });
    }

    to_array() {
        return localForage.getItem(this._key).then(list => {
            if (list === null) {
                list = [];
            }
            return Promise.resolve(list);
        });
    }

    assign_array(array) {
        return localForage.setItem(this._key, array);
    }
}

export class Queue extends List {
    pop() {
        return localForage.getItem(this._key).then(queue => {
            if (queue === null) {
                return Promise.resolve(null);
            }
            let item = queue.shift();
            return localForage.setItem(this._key, queue).then(_ => Promise.resolve(item));
        });
    }

    peek() {
        return localForage.getItem(this._key).then(queue => {
            if (queue === null) {
                return Promise.resolve(null);
            }
            return Promise.resolve(queue[0]);
        });
    }
}

export class Dictionary {
    constructor(key) {
        this._key = key;
    }

    set(key, value) {
        return localForage.getItem(this._key).then(dict => {
            if (dict === null) {
                dict = {};
            }
            dict[key] = value;
            return localForage.setItem(this._key, dict);
        });
    }

    merge(otherDict) {
        return localForage.getItem(this._key).then(dict => {
            if (dict === null) {
                dict = {};
            }
            Object.keys(otherDict).forEach(key => dict[key] = otherDict[key]);
            return localForage.setItem(this._key, dict);
        });
    }

    get(key) {
        return localForage.getItem(this._key).then(dict => {
            if (dict === null) {
                dict = {};
            }
            return Promise.resolve(dict[key]);
        });
    }

    to_object() {
        return localForage.getItem(this._key).then(dict => {
            if (dict === null) {
                dict = {};
            }
            return Promise.resolve(dict);
        });
    }
}
