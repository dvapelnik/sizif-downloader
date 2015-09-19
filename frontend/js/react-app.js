var WorkPlace = React.createClass({
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
            <span className={className}>{message}</span>
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
            <div className="row" style={this.state.containerStyle}>
                <div className="col-md-12">
                    <div className="row">
                        <div className="col-md-6 col-md-offset-3">
                            <div className="input-group">
                                <input
                                    value={this.state.url}
                                    type="text"
                                    onChange={this.handleChangeUrlField}
                                    className="form-control"
                                    placeholder="http://google.com"/>
                            <span className="input-group-btn">
                            <button
                                onClick={this.handleClickMakeJob}
                                className="btn btn-success"
                                type="button">Save!
                            </button>
                        </span>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-md-8 col-md-offset-2" style={{'text-align':'right'}}>
                            {this.getAjaxStatus()}
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-md-8 col-md-offset-2">
                            <table className="table table-hover">
                                <thead>
                                <tr>
                                    <th>#</th>
                                    <th>URL</th>
                                    <th>Images</th>
                                    <th>Status</th>
                                </tr>
                                </thead>
                                <tbody>
                                {
                                    this.state.jobList.map(function (job, index) {
                                        var statusClass = cx({
                                            primary: job.status == 'created',
                                            default: job.status == 'pending',
                                            info: job.status == 'in_progress',
                                            success: job.status == 'complete',
                                            danger: job.status == 'error'
                                        });

                                        var images = <div></div>;

                                        if (job.files) {
                                            images = (
                                                <div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-xs"
                                                        data-toggle="modal"
                                                        data-target={'#job-'+job.id}>
                                                        <span className="glyphicon glyphicon-search"></span>
                                                    </button>

                                                    <div className="modal fade" id={'job-'+job.id} role="dialog"
                                                         aria-labelledby="myModalLabel">
                                                        <div className="modal-dialog modal-lg" role="document">
                                                            <div className="modal-content">
                                                                <div className="modal-header">
                                                                    <button type="button" className="close"
                                                                            data-dismiss="modal" aria-label="Close">
                                                                        <span aria-hidden="true">&times;</span></button>
                                                                    <h4 className="modal-title" id="myModalLabel">
                                                                        <a href={job.url} target="_blank">{job.url}</a>
                                                                    </h4>
                                                                </div>
                                                                <div className="modal-body"
                                                                     style={{'text-align': 'center'}}>
                                                                    {
                                                                        job.files.map(function (file) {
                                                                            return (
                                                                                <img
                                                                                    style={imageStyle}
                                                                                    src={file.path.retrieve}
                                                                                    alt=""/>
                                                                            )
                                                                        })
                                                                    }
                                                                </div>
                                                                <div className="modal-footer">
                                                                    <button type="button" className="btn btn-default"
                                                                            data-dismiss="modal">Close
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <tr>
                                                <td>{index + 1}</td>
                                                <td>
                                                    <a href={job.url} target="_blank">
                                                        {
                                                            job.url.substring(0, 30) + (
                                                                job.url.substring(0, 30).length < job.url.length
                                                                    ? '...' : '' )
                                                        }
                                                    </a>
                                                </td>
                                                <td>{images}</td>
                                                <td>
                                                    <span className={'label label-'+statusClass}>
                                                        {statusVerbosely[job.status]}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

React.render(
    <WorkPlace/>, document.getElementById('view-point')
);