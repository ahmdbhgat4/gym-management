/*
    Customer (first-time | subscribed)
    person = {
        id: string;
        full_name: string;
        phone: string;
        age: number;
        gender: string;
        notes: string;
        created_at: number;
    }
    customer = {
        ...person;
        height: number;
        weight: number;
        joined_plan: object;
    }

    plan = {
        id: string;
        type: string; 'single' | 'monthly:12' | 'monthly:16'
        price: number;
        no_of_sessions: number; 1 | 12 | 16
    }
 */

const constVars = {
    STORE_NAME: 'myStore',
    CUSTOMERS_NAME: 'customers',
    PLANS_NAME: 'plans',
    DATE_TIME_FORMAT: 'MMM dd, yyyy - hh:mmaaa',
    DATE_FORMAT: 'MMM dd, yyyy',
    TIME_FORMAT: 'hh:mmaaa',
};

idb.openDB(constVars.STORE_NAME, undefined, {
    upgrade(db) {
        db.createObjectStore(constVars.PLANS_NAME, { keyPath: 'id' });
        db.createObjectStore(constVars.CUSTOMERS_NAME, { keyPath: 'id' });
    },
});

fetchPlans();
fetchCustomers();
handleEvents();

class Person {
    constructor({ full_name, phone, gender, age, notes }) {
        this.full_name = full_name;
        this.gender = gender;
        this.phone = phone || null;
        this.age = age || null;
        this.notes = notes || null;
        this.created_at = new Date(Date.now()).toString();
        this.id = this.generateId();
    }

    generateId() {
        return String(this.full_name).toLowerCase().replaceAll(' ', '_') + Date.now();
    }
}

class Customer extends Person {
    constructor({ full_name, phone, gender, age, notes, weight, height }) {
        super({ full_name, phone, gender, age, notes });
        this.weight = weight;
        this.height = height;
    }

    async joinPlan(id = '') {
        const db = await idb.openDB(constVars.STORE_NAME);
        const planData = db.get(constVars.PLANS_NAME, id);
        if (planData) {
            this.joined_plan = {
                id,
                attended_sessions: 0,
                joined_date: new Date(Date.now()).toString(),
                expired: false,
                completed: false,
            };

            // update db
            db.put(constVars.CUSTOMERS_NAME, this);
        } else {
            console.error("plan doesn't exist?!");
        }
    }
}

class Plan {
    constructor({ type, price, no_of_sessions }) {
        this.type = type;
        this.price = price;
        this.no_of_sessions = no_of_sessions;
        this.id = this.generateId();
    }

    generateId() {
        return `${this.type}_${this.price}_${this.no_of_sessions}`;
    }
}

function handleEvents() {
    const form = document.querySelector('[data-form="create"]');
    form.addEventListener('submit', e => {
        e.preventDefault();

        createCustomer({
            full_name: form.full_name.value,
            age: +form.age.value,
            gender: form.gender.value,
            phone: form.phone.value,
            notes: form.notes.value,
            weight: +form.weight.value,
            height: +form.height.value,
        });
    });

    const dialogTogglers = document.querySelectorAll('[data-dialog-toggle]');
    dialogTogglers.forEach(toggler => {
        toggler.addEventListener('click', e => {
            e.preventDefault();
            const dialogName = toggler.getAttribute('data-dialog-toggle');
            toggleDialog(dialogName);
        });
    });

    const table = document.querySelector('[data-table="customers"]');
    table.addEventListener('click', e => {
        if (e.target.closest('[data-customer-action]')) {
            const actionEl = e.target.closest('[data-customer-action]');
            const actionType = actionEl.getAttribute('data-customer-action');
            const customerId = actionEl.closest('[data-customer-id]')?.getAttribute('data-customer-id');

            switch (actionType) {
                case 'edit':
                    toggleDialog(actionType, customerId);
                    break;
                case 'delete':
                    const res = confirm('Are you sure to delete?!');
                    if (res) {
                        deleteCustomer(customerId);
                    }
                    break;
                default:
                    break;
            }
        }
    });
}

async function deleteCustomer(id = '') {
    const db = await idb.openDB(constVars.STORE_NAME);

    try {
        await db.delete(constVars.CUSTOMERS_NAME, id);
        renderCustomers();
    } catch (err) {
        console.log(err);
    } finally {
        // loaded
    }
}

async function createCustomer(data = {}) {
    const customerData = new Customer(data);

    const db = await idb.openDB(constVars.STORE_NAME);
    try {
        await db.add(constVars.CUSTOMERS_NAME, customerData);
        renderCustomers();
        toggleDialog('all');
    } catch (err) {
        console.log(err);
    } finally {
        // loaded
    }
}

async function toggleDialog(name = '', customerId = '') {
    const dialogs = document.querySelectorAll('[data-dialog]');
    dialogs.forEach(dialogEl => {
        dialogEl.classList.remove('is-active');
    });
    document.body.classList.remove('dialog-is-active');

    if (name !== 'all') {
        const targetDialog = document.querySelector(`[data-dialog="${name}"]`);
        if (targetDialog) {
            targetDialog.classList.toggle('is-active');
            document.body.classList.toggle('dialog-is-active');

            if (name === 'edit') {
                const listEl = targetDialog.querySelector('[data-customer-modal-info]');
                listEl.innerHTML = '';

                const plansContainer = targetDialog.querySelector('[data-plans]');
                plansContainer.innerHTML = '';

                const db = await idb.openDB(constVars.STORE_NAME);
                const customerData = await db.get(constVars.CUSTOMERS_NAME, customerId);
                let plans = await db.getAll(constVars.PLANS_NAME);
                const keys = Object.keys(customerData).sort((a, b) => a - b);
                keys.forEach(key => {
                    let value = customerData[key];

                    if (key === 'created_at') {
                        value = dateFns.format(new Date(value), constVars.DATE_TIME_FORMAT);
                    }

                    const itemHtml = `
                        <li class="flex items-center gap-2 border-b-1 border-gray-100">
                            <span class="w-30 bg-gray-100 p-2 text-center font-semibold uppercase">${key.replaceAll('_', ' ')}</span>
                            <span>${value || '----'}</span>
                        </li>
                    `;
                    listEl.insertAdjacentHTML('beforeend', itemHtml);
                });

                plans.sort((a, b) => {
                    return a.no_of_sessions - b.no_of_sessions;
                });
                plans.forEach(({ id, name, price, no_of_sessions }, index) => {
                    const planHtml = `
                        <div>
                            <input id="${id}" type="radio" name="customer_plan" ${index === 0 ? 'checked' : ''} data-plan-checker hidden />
                            <label
                                for="${id}"
                                class="border-1 cursor-pointer border-gray-100 rounded-2xl w-full p-3 flex items-center justify-between"
                            >
                                <div class="">
                                    <strong class="text-2xl font-semibold">${name}</strong>
                                    <p class="text-gray-500 text-xl font-semibold mt-1">${price} LE</p>
                                </div>
                                <strong
                                    class="text-3xl font-semibold flex items-center justify-center text-white bg-gray-800 w-13 h-13 rounded-full"
                                    >${no_of_sessions}</strong
                                >
                            </label>
                        </div>
                    `;

                    plansContainer.insertAdjacentHTML('beforeend', planHtml);
                });
            }
        }
    }
}

async function renderCustomers() {
    const db = await idb.openDB(constVars.STORE_NAME);
    const data = await db.getAll(constVars.CUSTOMERS_NAME);

    const table = document.querySelector('[data-table="customers"]');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    thead.innerHTML = '';
    tbody.innerHTML = '';

    const headingKeys = ['id', 'full_name', 'gender', 'created_at', 'actions']; //Object.keys(data[0]);

    const theadRow = document.createElement('tr');
    headingKeys.forEach(key => {
        const theadCol = document.createElement('th');
        theadCol.textContent = key.replaceAll('_', ' ');
        theadRow.append(theadCol);
    });
    thead.append(theadRow);

    data.forEach(customerObj => {
        const tbodyRow = document.createElement('tr');
        tbodyRow.dataset.customerId = customerObj.id;

        headingKeys.forEach(key => {
            const tbodyCol = document.createElement('td');
            let value = customerObj[key];
            switch (key) {
                case 'created_at':
                    value = dateFns.format(new Date(value), constVars.DATE_TIME_FORMAT);
                    tbodyCol.textContent = value || '----';
                    break;
                case 'actions':
                    tbodyCol.className = 'flex items-center justify-center gap-2';
                    const editBtn = `
                        <button class="p-2 bg-blue-600 text-white rounded-lg cursor-pointer font-semibold transition-colors outline-2 outline-offset-2 outline-transparent hover:bg-blue-700 focus:outline-blue-600" data-customer-action="edit" aria-label="edit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/>
                            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/>
                            </svg>
                        </button>
                    `;
                    const deleteBtn = `
                        <button class="p-2 bg-red-600 text-white rounded-lg cursor-pointer font-semibold transition-colors outline-2 outline-offset-2 outline-transparent hover:bg-red-700 focus:outline-red-600" data-customer-action="delete" aria-label="delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                            </svg>
                        </button>
                    `;

                    tbodyCol.insertAdjacentHTML('beforeend', editBtn);
                    tbodyCol.insertAdjacentHTML('beforeend', deleteBtn);
                    break;
                default:
                    tbodyCol.textContent = value || '----';
                    break;
            }
            tbodyRow.append(tbodyCol);
        });

        tbody.append(tbodyRow);
    });
}

// api
async function fetchPlans() {
    try {
        const res = await fetch('api/plans.json');
        const data = await res.json();
        const db = await idb.openDB(constVars.STORE_NAME);

        data.data.forEach(async planObj => {
            const exists = await db.get(constVars.PLANS_NAME, planObj.id);
            if (exists) {
                db.put(constVars.PLANS_NAME, planObj);
            } else {
                db.add(constVars.PLANS_NAME, planObj);
            }
        });
    } catch (err) {
        console.log(err);
    } finally {
        // loaded
    }
}

async function fetchCustomers() {
    try {
        const res = await fetch('api/customers.json');
        const data = await res.json();
        const db = await idb.openDB(constVars.STORE_NAME);

        data.data.forEach(async customerObj => {
            // clear if api data.len < offline stored
            const exists = await db.get(constVars.CUSTOMERS_NAME, customerObj.id);
            if (exists) {
                db.put(constVars.CUSTOMERS_NAME, customerObj);
            } else {
                db.add(constVars.CUSTOMERS_NAME, customerObj);
            }
        });

        renderCustomers();
    } catch (err) {
        console.log(err);
    } finally {
        // loaded
    }
}
