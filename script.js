let currentUser = null;
let tasks = [];
let currentFilter = "All";
let dragStartId = null;
let swipeStartX = null;

window.onload = () => {
  const savedUser = localStorage.getItem("username");
  if (savedUser) {
    currentUser = savedUser;
    showApp();
  }

  taskInput.addEventListener("keypress", e => {
    if (e.key === "Enter") addTask();
  });

  taskList.addEventListener("touchstart", e => swipeStartX = e.touches[0].clientX);
  taskList.addEventListener("touchend", handleSwipe);
};

/* AUTH */
function login() {
  const name = usernameInput.value.trim();
  if (!name) return alert("Please enter a name");

  localStorage.setItem("username", name);
  currentUser = name;
  showApp();
}

function logout() {
  localStorage.clear();
  location.reload();
}

/* APP */
function showApp() {
  loginSection.classList.add("d-none");
  appSection.classList.remove("d-none");
  userDisplay.innerText = currentUser;

  loadTasks();
  renderTasks();
}

/* STORAGE */
function getKey() { return currentUser + "_tasks"; }

function loadTasks() {
  try { tasks = JSON.parse(localStorage.getItem(getKey())) || []; }
  catch { tasks = []; }
}

function saveTasks() {
  try { localStorage.setItem(getKey(), JSON.stringify(tasks)); }
  catch { alert("Storage full. Clear some tasks."); }
}

/* ADD TASK */
function addTask() {
  const text = taskInput.value.trim();
  if (!text) return alert("Task cannot be empty");

  tasks.push({
    id: Date.now(),
    text,
    category: taskCategory.value,
    priority: taskPriority.value,
    date: taskDate.value,
    completed: false,
    notified: false
  });

  taskInput.value = "";
  saveTasks();
  renderTasks();
}

/* INLINE EDIT (Text + Category + Priority + Date) */
function startEdit(span, id, field) {
  const task = tasks.find(t => t.id === id);
  let input;
  if(field === "text") {
    input = document.createElement("input");
    input.value = task.text;
    input.className = "edit-input";
  } else if(field === "category") {
    input = document.createElement("select");
    ["To Do","To Buy","Personal","Work"].forEach(c=>{
      const opt = document.createElement("option");
      opt.value=opt.text=c;
      if(task.category===c) opt.selected=true;
      input.appendChild(opt);
    });
  } else if(field==="priority") {
    input = document.createElement("select");
    ["Low","Medium","High"].forEach(p=>{
      const opt=document.createElement("option");
      opt.value=opt.text=p;
      if(task.priority===p) opt.selected=true;
      input.appendChild(opt);
    });
  } else if(field==="date") {
    input = document.createElement("input");
    input.type="date";
    input.value = task.date || "";
    input.className="edit-input";
  }

  span.replaceWith(input);
  input.focus();

  input.addEventListener("blur", ()=>{
    if(field==="text") task.text=input.value.trim()||task.text;
    else if(field==="category") task.category=input.value;
    else if(field==="priority") task.priority=input.value;
    else if(field==="date") task.date=input.value;
    saveTasks();
    renderTasks();
  });

  input.addEventListener("keypress", e=>{if(e.key==="Enter") input.blur();});
}

/* DELETE */
function deleteTask(id, el) {
  el.closest("li").classList.add("fade-out");
  setTimeout(()=>{
    tasks=tasks.filter(t=>t.id!==id);
    saveTasks();
    renderTasks();
  },300);
}

/* TOGGLE */
function toggleTask(id) {
  const task = tasks.find(t=>t.id===id);
  task.completed = !task.completed;
  saveTasks();
  renderTasks();
}

/* FILTER */
function setFilter(filter, el) {
  currentFilter = filter;
  document.querySelectorAll("#filters button").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  renderTasks();
}

/* RENDER */
function renderTasks() {
  taskList.innerHTML="";
  let filtered = tasks;

  const searchText = searchInput.value.trim().toLowerCase();
  if(currentFilter!=="All") {
    filtered = filtered.filter(t=>t.category===currentFilter || t.priority===currentFilter);
  }
  if(searchText) filtered=filtered.filter(t=>t.text.toLowerCase().includes(searchText));

  if(filtered.length===0){
    taskList.innerHTML=`<div class="text-center text-muted py-5">
      <h6>No tasks here</h6><small>Add something to get started</small></div>`;
    updateCounter();
    return;
  }

  const priorityMap={High:3,Medium:2,Low:1};
  filtered.sort((a,b)=>{
    if(a.completed!==b.completed) return a.completed?1:-1;
    if(priorityMap[b.priority]!==priorityMap[a.priority]) return priorityMap[b.priority]-priorityMap[a.priority];
    return new Date(a.date||0)-new Date(b.date||0);
  });

  filtered.forEach(task=>{
    const li=document.createElement("li");
    li.className=`list-group-item priority-${task.priority} ${task.completed?"task-completed":""}`;
    li.setAttribute("draggable",true);
    li.dataset.id=task.id;

    li.innerHTML=`
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <input type="checkbox" ${task.completed?"checked":""} onclick="toggleTask(${task.id})" aria-label="Mark complete">
        <span ondblclick="startEdit(this,${task.id},'text')">${task.text}</span>
        <span class="badge" ondblclick="startEdit(this,${task.id},'category')">${task.category}</span>
        <span class="badge badge-priority" ondblclick="startEdit(this,${task.id},'priority')">${task.priority}</span>
        <small ondblclick="startEdit(this,${task.id},'date')">${task.date||""}</small>
      </div>
      <div>
        <button onclick="deleteTask(${task.id},this)" aria-label="Delete task">✕</button>
      </div>
    `;
    taskList.appendChild(li);
  });

  updateCounter();
}

function updateCounter(){
  const done=tasks.filter(t=>t.completed).length;
  taskCounter.innerText=`${done} / ${tasks.length}`;
}

/* DRAG & DROP */
document.addEventListener("dragstart",e=>{
  const li=e.target.closest("li");
  if(li) dragStartId=Number(li.dataset.id);
});
document.addEventListener("dragover",e=>e.preventDefault());
document.addEventListener("drop",e=>{
  const target=e.target.closest("li");
  if(!target) return;
  const dropId=Number(target.dataset.id);
  const from=tasks.findIndex(t=>t.id===dragStartId);
  const to=tasks.findIndex(t=>t.id===dropId);
  const [moved]=tasks.splice(from,1);
  tasks.splice(to,0,moved);
  saveTasks();
  renderTasks();
});

/* SWIPE */
function handleSwipe(e){
  const touchEndX=e.changedTouches[0].clientX;
  const delta=swipeStartX-touchEndX;
  if(Math.abs(delta)>80){
    const li=e.target.closest("li");
    if(!li) return;
    li.classList.add("swipe-left");
    const id=Number(li.dataset.id);
    setTimeout(()=>deleteTask(id,li.querySelector("button")),300);
  }
}

/* DARK MODE */
function toggleDarkMode(){
  document.body.classList.toggle("dark");
}

/* REMINDERS */
setInterval(()=>{
  const today=new Date().toISOString().split("T")[0];
  tasks.forEach(task=>{
    if(task.date===today && !task.completed && !task.notified){
      if(Notification.permission==="granted"){
        new Notification("Reminder",{body:task.text});
        task.notified=true;
        saveTasks();
      } else Notification.requestPermission();
    }
  });
},60000);

/* AUTO DARK MODE */
const hour = new Date().getHours();
if(hour>=19 || hour<6) document.body.classList.add("dark");