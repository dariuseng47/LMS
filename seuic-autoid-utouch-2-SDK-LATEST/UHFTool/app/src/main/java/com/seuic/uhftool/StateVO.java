package com.seuic.uhftool;

public class StateVO {
    private String title;
    private boolean selected;

    public StateVO(String title, boolean selected) {
        this.title = title;
        this.selected = selected;
    }

    public StateVO() {

    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public boolean isSelected() {
        return selected;
    }

    public void setSelected(boolean selected) {
        this.selected = selected;
    }
}
