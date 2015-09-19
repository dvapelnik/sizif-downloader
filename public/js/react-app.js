var WorkPlace = React.createClass({
    displayName: "WorkPlace",
    getInitialState: function () {
        return {
            url: '',
            containerStyle: {
                'margin-top': '100px'
            },
            jobList: [],
            ajaxIsActive: false,
            timeOut: 2000
        };
    },
    componentDidMount: function () {
        this.tick();
    },
    componentWillUnmount: function () {
    },
    tick: function () {
        var that = this;

        $.ajax({
            type: 'get',
            url: '/job/list',
            beforeSend: function () {
                that.setState({ajaxIsActive: true});
            },
            success: function (data) {
                if (data.status == 'OK' && data.data) {
                    that.setState({
                        jobList: data.data
                    });
                }

                setTimeout(that.tick, that.state.timeOut);
            },
            complete: function () {
                that.setState({ajaxIsActive: false});
            }
        })
    },
    getAjaxStatus: function () {
        var className = this.state.ajaxIsActive
            ? 'label label-warning'
            : 'label label-success';
        var message = this.state.ajaxIsActive
            ? 'Updating...'
            : 'Updated';

        return (
            React.createElement("span", {className: className}, message)
        );
    },
    handleChangeUrlField: function (event) {
        this.setState({
            url: event.target.value
        });
    },
    handleClickMakeJob: function () {
        var url = this.state.url;
        var that = this;

        $.ajax({
            type: 'post',
            url: '/job/make',
            datatype: "json",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({
                url: url
            }),
            beforeSend: function () {
                that.setState({ajaxIsActive: true});
            },
            success: function (data) {
                $.growl.notice({message: 'Complete!'});
                that.setState({url: ''});
            },
            error: function (jqXHR) {
                var data = JSON.parse(jqXHR.responseText);

                console.log(data);

                $.growl.error({
                    title: 'Error occurred!',
                    message: data.message
                });
            },
            complete: function () {
                that.setState({ajaxIsActive: false});
            }
        });
    },
    render: function () {
        var cx = React.addons.classSet;
        var imageStyle = {
            height: '100px',
            margin: '10px',
            border: '1px solid black'
        };
        var statusVerbosely = {
            created: 'Created',
            pending: 'Pending',
            in_progress: 'In progress',
            complete: 'Complete',
            error: 'Complete with error'
        };

        return (
            React.createElement("div", {className: "row", style: this.state.containerStyle},
                React.createElement("div", {className: "col-md-12"},
                    React.createElement("div", {className: "row"},
                        React.createElement("div", {className: "col-md-6 col-md-offset-3"},
                            React.createElement("div", {className: "input-group"}, 
                                React.createElement("input", {
                                    value: this.state.url,
                                    type: "text",
                                    onChange: this.handleChangeUrlField,
                                    className: "form-control",
                                    placeholder: "http://google.com"
                                }),
                                React.createElement("span", {className: "input-group-btn"},
                                    React.createElement("button", {
                                            onClick: this.handleClickMakeJob,
                                            className: "btn btn-success",
                                            type: "button"
                                        }, "Save!"
                            )
                        )
                            )
                        )
                    ),
                    React.createElement("div", {className: "row"},
                        React.createElement("div", {
                                className: "col-md-8 col-md-offset-2",
                                style: {'text-align': 'right'}
                            },
                            this.getAjaxStatus()
                        )
                    ),
                    React.createElement("div", {className: "row"},
                        React.createElement("div", {className: "col-md-8 col-md-offset-2"},
                            React.createElement("table", {className: "table table-hover"},
                                React.createElement("thead", null,
                                    React.createElement("tr", null,
                                        React.createElement("th", null, "#"),
                                        React.createElement("th", null, "URL"),
                                        React.createElement("th", null, "Images"),
                                        React.createElement("th", null, "Status")
                                    )
                                ),
                                React.createElement("tbody", null, 
                                
                                    this.state.jobList.map(function (job, index) {
                                        var statusClass = cx({
                                            primary: job.status == 'created',
                                            default: job.status == 'pending',
                                            info: job.status == 'in_progress',
                                            success: job.status == 'complete',
                                            danger: job.status == 'error'
                                        });

                                        var images = React.createElement("div", null);

                                        if (job.files) {
                                            images = (
                                                React.createElement("div", null, 
                                                    React.createElement("button", {
                                                            type: "button",
                                                            className: "btn btn-primary btn-xs",
                                                            "data-toggle": "modal",
                                                            "data-target": '#job-' + job.id
                                                        },
                                                        React.createElement("span", {className: "glyphicon glyphicon-search"})
                                                    ),

                                                    React.createElement("div", {
                                                            className: "modal fade",
                                                            id: 'job-' + job.id,
                                                            role: "dialog",
                                                            "aria-labelledby": "myModalLabel"
                                                        },
                                                        React.createElement("div", {
                                                                className: "modal-dialog modal-lg",
                                                                role: "document"
                                                            },
                                                            React.createElement("div", {className: "modal-content"},
                                                                React.createElement("div", {className: "modal-header"},
                                                                    React.createElement("button", {
                                                                            type: "button",
                                                                            className: "close",
                                                                            "data-dismiss": "modal",
                                                                            "aria-label": "Close"
                                                                        },
                                                                        React.createElement("span", {"aria-hidden": "true"}, "×")),
                                                                    React.createElement("h4", {
                                                                            className: "modal-title",
                                                                            id: "myModalLabel"
                                                                        },
                                                                        React.createElement("a", {
                                                                            href: job.url,
                                                                            target: "_blank"
                                                                        }, job.url)
                                                                    )
                                                                ),
                                                                React.createElement("div", {
                                                                        className: "modal-body",
                                                                        style: {'text-align': 'center'}
                                                                    },

                                                                    job.files.map(function (file) {
                                                                        return (
                                                                            React.createElement("img", {
                                                                                style: imageStyle,
                                                                                src: file.path.retrieve,
                                                                                alt: ""
                                                                            })
                                                                        )
                                                                    })
                                                                ),
                                                                React.createElement("div", {className: "modal-footer"},
                                                                    React.createElement("button", {
                                                                            type: "button",
                                                                            className: "btn btn-default",
                                                                            "data-dismiss": "modal"
                                                                        }, "Close"
                                                                    )
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            );
                                        }

                                        return (
                                            React.createElement("tr", null,
                                                React.createElement("td", null, index + 1),
                                                React.createElement("td", null,
                                                    React.createElement("a", {href: job.url, target: "_blank"},

                                                        job.url.substring(0, 30) + (
                                                            job.url.substring(0, 30).length < job.url.length
                                                                ? '...' : '')
                                                        
                                                    )
                                                ),
                                                React.createElement("td", null, images),
                                                React.createElement("td", null,
                                                    React.createElement("span", {className: 'label label-' + statusClass},
                                                        statusVerbosely[job.status]
                                                    )
                                                )
                                            )
                                        );
                                    })
                                )
                            )
                        )
                    )
                )
            )
        );
    }
});

React.render(
    React.createElement(WorkPlace, null), document.getElementById('view-point')
);