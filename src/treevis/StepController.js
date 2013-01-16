// Copyright (c) 2011-2013 UX Productivity Pty Ltd. All rights reserved.

(function() {

    function update(self)
    {
        self.slider.setRange(0,UndoManager_getLength());
        self.slider.value = UndoManager_getIndex();
        self.treeView.update();
        placeToplevelGroups(self);
    }

    function valueChanged(self,value)
    {
        UndoManager_setIndex(value);
        update(self);
    }

    function keypress(self,event)
    {
        var KEYCODE_LEFT = 37;
        var KEYCODE_RIGHT = 39;
        var KEYCODE_HOME = 36;
        var KEYCODE_END = 35;
        var KEYCODE_PGUP = 33;
        var KEYCODE_PGDOWN = 34;

        switch (event.keyCode) {
        case KEYCODE_LEFT:
            self.slider.value--;
            valueChanged(self,self.slider.value);
            break;
        case KEYCODE_RIGHT:
            self.slider.value++;
            valueChanged(self,self.slider.value);
            break;
        case KEYCODE_HOME:
            self.slider.value = 0;
            valueChanged(self,self.slider.value);
            break;
        case KEYCODE_END:
            self.slider.value = UndoManager_getLength();
            valueChanged(self,self.slider.value);
            break;
        case KEYCODE_PGUP:
            self.slider.value = self.slider.value - 10;
            valueChanged(self,self.slider.value);
            break;
        case KEYCODE_PGDOWN:
            self.slider.value = self.slider.value + 10;
            valueChanged(self,self.slider.value);
            break;
        }
    }

    function resize(self,event)
    {
        self.width = window.innerWidth;
        self.height = window.innerHeight;
        placeToplevelGroups(self);
    }

    function placeToplevelGroups(self)
    {
        var xOffset = self.width/2 - self.treeView.width/2;
        var yOffset = 40;
        self.treeView.setCoords(xOffset,yOffset);
        self.slider.setPosition(self.width*0.1,self.height - 80,self.width*0.8,40);
    }

    function StepController(domRoot)
    {
        Object.defineProperty(this,"self",{value: {}});
        var self = this.self;

        self.element = DOM_createElementNS(document,SVG_NAMESPACE,"g");
        self.treeView = new TreeView(domRoot);
        self.slider = new Slider();
        self.width = window.innerWidth;
        self.height = window.innerHeight;
        DOM_appendChild(self.element,self.treeView.element);
        DOM_appendChild(self.element,self.slider.element);

        self.slider.onValueChanged = function(value) { valueChanged(self,value) };
        document.onkeydown = function(event) { keypress(self,event); };
        window.onresize = function(event) { resize(self,event); }

        this.element = self.element;
        this.treeView = self.treeView;
        Object.freeze(this);
    }

    StepController.prototype.update = function()
    {
        var self = this.self;
        update(self);
    }

    window.StepController = StepController;

})();
